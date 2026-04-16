import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { register } from '../lib/api'

export default function Register() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole]         = useState('reviewer')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await register(email, password, role)
      navigate('/login')
    } catch (err) {
      setError(err.message || 'Registration failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="font-mono text-2xl text-accent font-medium">
            DocuExtract
          </span>
          <p className="text-white/40 text-sm mt-1">Create your account</p>
        </div>

        <div className="bg-surface-card border border-surface-border rounded-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-white/60 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-surface-raised border border-surface-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-accent transition-colors"
                placeholder="you@firm.com"
              />
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full bg-surface-raised border border-surface-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-accent transition-colors"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-1.5">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-surface-raised border border-surface-border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent transition-colors"
              >
                <option value="reviewer">Reviewer</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent hover:bg-accent/90 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
            >
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="text-center text-xs text-white/30 mt-5">
            Already have an account?{' '}
            <Link to="/login" className="text-accent hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
