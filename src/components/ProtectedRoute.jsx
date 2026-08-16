import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import useInactivityTimeout from '../hooks/useInactivityTimeout'

// 30-minute auto sign-out applies to anything wrapped by ProtectedRoute.
const INACTIVITY_MINUTES = 30

export default function ProtectedRoute({ children, requiredRole, allowIncompleteOnboarding = false }) {
  const [session, setSession] = useState(undefined)
  const [role, setRole] = useState(null)
  const [onboardingComplete, setOnboardingComplete] = useState(true)
  const [loading, setLoading] = useState(true)

  // Hook is safe to call unconditionally — it only does anything once mounted.
  // If the user isn't logged in we Navigate away below before any timer matters.
  useInactivityTimeout(INACTIVITY_MINUTES)

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        setSession(null)
        setLoading(false)
        return
      }

      setSession(session)

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, onboarding_complete')
        .eq('id', session.user.id)
        .single()

      setRole(profile?.role ?? null)
      // Default to true if the column read failed so we don't bounce the user
      // through /onboarding because of a transient lookup error.
      setOnboardingComplete(profile?.onboarding_complete ?? true)
      setLoading(false)
    }

    checkAuth()

    // Re-evaluate when auth changes elsewhere — a sign-out in another tab
    // used to leave this dashboard rendered until an API call failed.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setSession(null)
        setRole(null)
      } else if (event === 'SIGNED_IN') {
        checkAuth()
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <p className="text-forest">Loading...</p>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (requiredRole && role !== requiredRole) {
    return <Navigate to="/login" replace />
  }

  // Students who haven't finished onboarding get bounced to /onboarding,
  // unless we're already rendering /onboarding itself (allowIncompleteOnboarding).
  if (
    role === 'student' &&
    !onboardingComplete &&
    !allowIncompleteOnboarding
  ) {
    return <Navigate to="/onboarding" replace />
  }

  return children
}
