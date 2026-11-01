import { createContext, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type { Me } from '#/lib/auth'
import CreateClassForm from '#/components/forms/create-class-form'
import { AddStudentsPanel } from '#/components/add-students-panel'
import type { ConnectNotice } from '#/components/classroom-connect-notice'
import { ResponsiveDialog } from '#/components/responsive-dialogue'

type CreateDialogs = {
  openCreateClass: () => void
  /** notice: how "Connect Google Classroom" went, shown above the Google part. */
  openAddStudents: (notice?: ConnectNotice | null) => void
}

const CreateDialogsContext = createContext<CreateDialogs | null>(null)

/** Opens the + menu's dialogs from anywhere inside the signed-in pages. */
export function useCreateDialogs() {
  const dialogs = useContext(CreateDialogsContext)
  if (!dialogs) {
    throw new Error(
      'useCreateDialogs must be used inside CreateDialogsProvider',
    )
  }
  return dialogs
}

/**
 * The + menu's dialogs: Add Students and Create class. They live here, in the
 * signed-in layout, so they work from every page and from both + buttons
 * (top bar, and the phone bottom bar).
 */
export function CreateDialogsProvider({
  me,
  children,
}: {
  me: Me
  children: ReactNode
}) {
  const navigate = useNavigate()
  const [createClassOpen, setCreateClassOpen] = useState(false)
  const [addStudentsOpen, setAddStudentsOpen] = useState(false)
  const [notice, setNotice] = useState<ConnectNotice | null>(null)

  const dialogs = useMemo<CreateDialogs>(
    () => ({
      openCreateClass: () => setCreateClassOpen(true),
      openAddStudents: (next = null) => {
        setNotice(next)
        setAddStudentsOpen(true)
      },
    }),
    [],
  )

  // Show the class the students went into (no-op when already there).
  const goToClasses = () => void navigate({ to: '/classes' })

  return (
    <CreateDialogsContext.Provider value={dialogs}>
      {children}

      <ResponsiveDialog
        isOpen={addStudentsOpen}
        setIsOpen={(open: boolean) => {
          setAddStudentsOpen(open)
          // A connect result is only news the first time.
          if (!open) setNotice(null)
        }}
        title="Add Students"
        // Visible: the + works from any page, so say which class it's for.
        description={`To ${me.classroom.name}`}
        showDescription
        // Wider for the two columns of class cards. ResponsiveDialog keeps it
        // within the screen and scrolls the body.
        className="sm:max-w-2xl"
      >
        <AddStudentsPanel
          classroom={me.classroom}
          notice={notice}
          onDismissNotice={() => setNotice(null)}
          onAdded={() => {
            // The new students are on the page by now, and a toast says how
            // many were added.
            setAddStudentsOpen(false)
            goToClasses()
          }}
          // Stays open: the cards say what was imported, and the teacher may
          // want to bring in another class.
          onImported={goToClasses}
        />
      </ResponsiveDialog>

      <ResponsiveDialog
        isOpen={createClassOpen}
        setIsOpen={setCreateClassOpen}
        title="Create class"
        description="Name your new class"
      >
        <CreateClassForm onSuccess={() => setCreateClassOpen(false)} />
      </ResponsiveDialog>
    </CreateDialogsContext.Provider>
  )
}
