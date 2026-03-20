import { supabase } from './supabase'
import { fetchTodayItems } from './logs'
import type { Family, FamilyMember, FamilyMemberWithEmail, FamilyRole, TodayItem } from './types'

/**
 * Generate a random 6-character invite code (uppercase letters + digits)
 */
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Avoid ambiguous O/0, I/1
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

/**
 * Create a new family. The creator becomes the owner.
 */
export async function createFamily(
  userId: string,
  name: string
): Promise<{ family: Family; inviteCode: string }> {
  // Generate unique invite code (retry if collision)
  let inviteCode = generateInviteCode()
  let attempts = 0

  while (attempts < 5) {
    const { data: existing } = await supabase
      .from('families')
      .select('id')
      .eq('invite_code', inviteCode)
      .maybeSingle()

    if (!existing) break
    inviteCode = generateInviteCode()
    attempts++
  }

  // Create family
  const { data: family, error: familyError } = await supabase
    .from('families')
    .insert({
      name,
      invite_code: inviteCode,
      created_by: userId,
    })
    .select()
    .single()

  if (familyError) throw familyError

  // Add creator as owner
  const { error: memberError } = await supabase
    .from('family_members')
    .insert({
      family_id: family.id,
      user_id: userId,
      role: 'owner',
    })

  if (memberError) throw memberError

  return { family, inviteCode }
}

/**
 * Join a family by invite code.
 */
export async function joinFamily(
  userId: string,
  inviteCode: string,
  role: FamilyRole = 'member'
): Promise<FamilyMember> {
  // Look up family by invite code
  const { data: family, error: lookupError } = await supabase
    .from('families')
    .select('*')
    .eq('invite_code', inviteCode.toUpperCase().trim())
    .maybeSingle()

  if (lookupError) throw lookupError
  if (!family) throw new Error('邀请码无效，请检查后重试')

  // Check if already a member
  const { data: existing } = await supabase
    .from('family_members')
    .select('id')
    .eq('family_id', family.id)
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) throw new Error('你已经是这个家庭的成员了')

  // Join
  const { data: member, error: joinError } = await supabase
    .from('family_members')
    .insert({
      family_id: family.id,
      user_id: userId,
      role,
    })
    .select()
    .single()

  if (joinError) throw joinError
  return member
}

/**
 * Get the user's family (returns first family they belong to).
 */
export async function getMyFamily(
  userId: string
): Promise<{ family: Family; members: FamilyMemberWithEmail[] } | null> {
  // Get user's family membership
  const { data: membership, error: memError } = await supabase
    .from('family_members')
    .select('family_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  if (memError) throw memError
  if (!membership) return null

  // Get family details
  const { data: family, error: famError } = await supabase
    .from('families')
    .select('*')
    .eq('id', membership.family_id)
    .single()

  if (famError) throw famError

  // Get all members
  const { data: members, error: membersError } = await supabase
    .from('family_members')
    .select('*')
    .eq('family_id', membership.family_id)
    .order('joined_at', { ascending: true })

  if (membersError) throw membersError

  // Try to get emails via auth (this requires the user to have access)
  // In practice, we'll show nickname or "成员" as fallback
  const enrichedMembers: FamilyMemberWithEmail[] = (members || []).map(m => ({
    ...m,
    email: undefined, // Email is not directly accessible via client-side
  }))

  return { family, members: enrichedMembers }
}

/**
 * Get today's medication items for a family member.
 */
export async function getMemberTodayItems(memberId: string): Promise<TodayItem[]> {
  return fetchTodayItems(memberId)
}

/**
 * Help a family member mark their medication as taken.
 */
export async function markMemberMedTaken(logId: string): Promise<void> {
  const { error } = await supabase
    .from('medication_logs')
    .update({
      status: 'taken',
      taken_at: new Date().toISOString(),
    })
    .eq('id', logId)

  if (error) throw error
}

/**
 * Leave a family (delete own membership).
 */
export async function leaveFamily(userId: string, familyId: string): Promise<void> {
  const { error } = await supabase
    .from('family_members')
    .delete()
    .eq('family_id', familyId)
    .eq('user_id', userId)

  if (error) throw error

  // If this was the last member, delete the family too
  const { data: remaining } = await supabase
    .from('family_members')
    .select('id')
    .eq('family_id', familyId)
    .limit(1)

  if (!remaining || remaining.length === 0) {
    await supabase.from('families').delete().eq('id', familyId)
  }
}

/**
 * Update member nickname in family.
 */
export async function updateMemberNickname(
  memberId: string,
  nickname: string
): Promise<void> {
  const { error } = await supabase
    .from('family_members')
    .update({ nickname })
    .eq('id', memberId)

  if (error) throw error
}

/**
 * Remove a member from family (owner only).
 */
export async function removeFamilyMember(memberId: string): Promise<void> {
  const { error } = await supabase
    .from('family_members')
    .delete()
    .eq('id', memberId)

  if (error) throw error
}
