import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'

export const Route = createFileRoute('/')({ component: Home })

function Home() {

  // TanStack Query handles the state, loading spinners, and caching for you
  const { data: students, isLoading, error } = useQuery({
    queryKey: ['students'],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/users`)
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
  })

  console.log("studnets", students)
  console.log("isloading", isLoading)
  console.log('error', error)


  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold">Welcome to Student Behavior</h1>
      <a
        href="http://localhost:8080/auth/google/login"
        target="_blank"
        rel="noopener noreferrer"
      >
        Sign On With Google
      </a>
    </div>
  )
}
