import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured')
    }

    const { image_base64, media_type } = await req.json()

    if (!image_base64) {
      throw new Error('image_base64 is required')
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: media_type || 'image/png',
                data: image_base64,
              },
            },
            {
              type: 'text',
              text: `分析这张血糖仪/CGM App截图，提取以下信息并以JSON格式返回：

{
  "blood_sugar": 数值（mmol/L，如果是mg/dL请转换为mmol/L，1 mg/dL = 0.0555 mmol/L）,
  "unit": "mmol/L",
  "measured_at": "测量时间（ISO 8601格式，如果能识别的话）",
  "notes": "其他有用信息（如TIR、最高值、最低值、趋势等）",
  "confidence": "high/medium/low（识别置信度）"
}

注意事项：
- 如果截图不是血糖相关的，返回 {"error": "not_blood_sugar", "message": "这张图片似乎不是血糖数据"}
- 如果无法识别数值，返回 {"error": "unreadable", "message": "无法识别数据，请重新截图"}
- 只返回JSON，不要其他文字`,
            },
          ],
        }],
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Claude API error: ${response.status} ${error}`)
    }

    const result = await response.json()
    const text = result.content?.[0]?.text || ''

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Failed to parse Claude response')
    }

    const parsed = JSON.parse(jsonMatch[0])

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: 'analysis_failed', message: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
