import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase'

const jarvisAddCandidateCardCall = httpsCallable(functions, 'jarvisAddCandidateCard')
const jarvisUpdateCandidateCardCall = httpsCallable(functions, 'jarvisUpdateCandidateCard')
const jarvisDeleteCandidateCardCall = httpsCallable(functions, 'jarvisDeleteCandidateCard')
const jarvisAppendCommentToCardCall = httpsCallable(functions, 'jarvisAppendCommentToCard')
const jarvisMoveCardToSlotCall = httpsCallable(functions, 'jarvisMoveCardToSlot')
const jarvisClonePlanCall = httpsCallable(functions, 'jarvisClonePlan')
const jarvisResetPlanCall = httpsCallable(functions, 'jarvisResetPlan')
const jarvisRenameDayLabelCall = httpsCallable(functions, 'jarvisRenameDayLabel')
const jarvisRenameTripCall = httpsCallable(functions, 'jarvisRenameTrip')

export async function jarvisAddCandidateCard(card) {
  const result = await jarvisAddCandidateCardCall({ card })
  return result.data
}

export async function jarvisUpdateCandidateCard(cardId, patch) {
  const result = await jarvisUpdateCandidateCardCall({ cardId, patch })
  return result.data
}

export async function jarvisDeleteCandidateCard(cardId) {
  const result = await jarvisDeleteCandidateCardCall({ cardId })
  return result.data
}

export async function jarvisAppendCommentToCard(cardId, text) {
  const result = await jarvisAppendCommentToCardCall({ cardId, text })
  return result.data
}

export async function jarvisMoveCardToSlot(cardId, planId, date, zone, index) {
  const result = await jarvisMoveCardToSlotCall({ cardId, planId, date, zone, index })
  return result.data
}

export async function jarvisClonePlan(sourcePlanId, name) {
  const result = await jarvisClonePlanCall({ sourcePlanId, name })
  return result.data
}

export async function jarvisResetPlan(planId) {
  const result = await jarvisResetPlanCall({ planId })
  return result.data
}

export async function jarvisRenameDayLabel(planId, date, label) {
  const result = await jarvisRenameDayLabelCall({ planId, date, label })
  return result.data
}

export async function jarvisRenameTrip(title) {
  const result = await jarvisRenameTripCall({ title })
  return result.data
}
