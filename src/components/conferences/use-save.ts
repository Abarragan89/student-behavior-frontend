import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ConferenceConflict,
  cacheConference,
  conferenceQueryOptions,
  conflictMessage,
} from '#/lib/conferences'
import type { Conference } from '#/lib/conferences'

/**
 * Runs one of the teacher's changes to a conference and shows the page the
 * server answers with. Changes go out one at a time, in tap order. A change
 * refused because a family moved meanwhile reloads the page, so the teacher
 * sees why.
 */
export function useSaveConference(conferenceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (write: () => Promise<Conference>) => write(),
    scope: { id: `conference:${conferenceId}` },
    onSuccess: (saved) => cacheConference(queryClient, saved),
    onError: (error) => {
      console.error('Saving the conference failed:', error)
      toast.error('Couldn’t save that', { description: conflictMessage(error) })
      if (error instanceof ConferenceConflict) {
        void queryClient.invalidateQueries({
          queryKey: conferenceQueryOptions(conferenceId).queryKey,
        })
      }
    },
  })
}
