import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'

export const Route = createFileRoute('/')({ component: Home })

function Home() {

  // TanStack Query handles the state, loading spinners, and caching for you
  const { data: students, isLoading, error } = useQuery({
    queryKey: ['students'],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/students`)
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
  })

  console.log("studnets", students)
  console.log("isloading", isLoading)
  console.log('error', error)


  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold">Welcome to TanStack Start</h1>
      <p className="mt-4 text-lg">
        Edit <code>src/routes/index.tsx</code> to get started.
      </p>
    </div>
  )
}
