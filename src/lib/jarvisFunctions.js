import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase'

const jarvisAddCandidateCardCall = httpsCallable(functions, 'jarvisAddCandidateCard')
const jarvisUpdateCandidateCardCall = httpsCallable(functions, 'jarvisUpdateCandidateCard')
const jarvisDeleteCandidateCardCall = httpsCallable(functions, 'jarvisDeleteCandidateCard')
const jarvisAppendCommentToCardCall = httpsCallable(functions, 'jarvisAppendCommentToCard')

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
