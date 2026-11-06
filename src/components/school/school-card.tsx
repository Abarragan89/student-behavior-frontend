import { useId } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowRight, Building2 } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { Me } from '#/lib/auth'

/**
 * The Account page's School: the school you're in and your role, or how to
 * join or start one.
 */
export function SchoolCard({ me }: { me: Me }) {
  const headingId = useId()
  const school = me.school ?? null

  return (
    <section aria-labelledby={headingId}>
      <Card className="gap-4 rounded-lg border-2 border-border shadow-md ring-0 [--card-spacing:--spacing(6)]">
        <CardHeader>
          <h2
            id={headingId}
            className="flex items-center gap-2 text-lg font-bold"
          >
            <Building2 className="size-5" />
            School
          </h2>
          <CardDescription>
            {school
              ? `You’re ${school.role === 'admin' ? 'the administrator of' : 'a teacher at'} ${school.name}.`
              : 'Part of a school? Ask your administrator for the join link.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {school ? (
            <Link
              to="/school"
              className={cn(
                buttonVariants({ variant: 'outline' }),
                'h-11 rounded-lg border-2 px-4 font-bold',
              )}
            >
              {school.role === 'admin' ? 'Manage your school' : 'Open'}
              <ArrowRight />
            </Link>
          ) : (
            <div className="flex flex-col items-start gap-2">
              <p className="text-sm text-muted-foreground">
                Running a school? Start one and invite your staff with one link.
              </p>
              <Link
                to="/school/start"
                className={cn(
                  buttonVariants({ variant: 'outline' }),
                  'h-11 rounded-lg border-2 px-4 font-bold',
                )}
              >
                Start a school
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
