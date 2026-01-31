import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';

/**
 * AuthCallback page for handling cross-domain authentication
 *
 * Flow:
 * 1. User logs in on main domain (app.canliasistan.com)
 * 2. After login, redirect to subdomain with token: prestige.canliasistan.com/auth/callback?token=xxx
 * 3. This page extracts the token, stores it, and redirects to dashboard
 */
export const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('processing'); // processing, success, error
  const [error, setError] = useState(null);

  useEffect(() => {
    const processToken = async () => {
      try {
        const token = searchParams.get('token');
        const redirect = searchParams.get('redirect') || '/dashboard';

        if (!token) {
          setStatus('error');
          setError('No authentication token provided');
          return;
        }

        // Validate token format (basic check)
        if (!token.startsWith('demo_') && token.length < 10) {
          setStatus('error');
          setError('Invalid authentication token');
          return;
        }

        // Store the token
        localStorage.setItem('token', token);

        // Optionally fetch user data to validate token
        try {
          const response = await fetch('/api/auth/me', {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (!response.ok) {
            throw new Error('Token validation failed');
          }

          const data = await response.json();

          // Store user data
          if (data.user) {
            localStorage.setItem('user', JSON.stringify(data.user));
          }
        } catch (validationError) {
          console.error('Token validation error:', validationError);
          // Continue anyway - the app will redirect to login if token is invalid
        }

        setStatus('success');

        // Small delay to show success message, then redirect
        setTimeout(() => {
          // Clear URL params before redirect
          window.history.replaceState({}, document.title, '/auth/callback');
          navigate(redirect, { replace: true });
        }, 500);

      } catch (err) {
        console.error('Auth callback error:', err);
        setStatus('error');
        setError(err.message || 'Authentication failed');
      }
    };

    processToken();
  }, [searchParams, navigate]);

  // Render based on status
  if (status === 'processing') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-dark via-dark-card to-dark">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">
            Authenticating...
          </h2>
          <p className="text-gray-400">
            Please wait while we verify your credentials.
          </p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-dark via-dark-card to-dark">
        <div className="text-center max-w-md px-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-500/20 mb-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Authentication Failed
          </h2>
          <p className="text-gray-400 mb-6">
            {error}
          </p>
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-2 bg-primary text-black font-medium rounded-lg hover:bg-primary-light transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-dark via-dark-card to-dark">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-500/20 mb-4">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Authentication Successful
          </h2>
          <p className="text-gray-400">
            Redirecting to dashboard...
          </p>
        </div>
      </div>
    );
  }

  return null;
};

export default AuthCallback;
