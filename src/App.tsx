import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Activity, RefreshCw, MessageCircle, Heart, Repeat2, Eye, Quote, ExternalLink, Shield, LogOut, Info, Settings, AlertCircle } from 'lucide-react';

interface PostData {
  id: string;
  text: string;
  timestamp: string;
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  engagementRate: number;
}

const App: React.FC = () => {
  const [token, setToken] = useState<string>(localStorage.getItem('threads_token') || '');
  const [clientId, setClientId] = useState<string>(localStorage.getItem('threads_client_id') || '');
  const [clientSecret, setClientSecret] = useState<string>(localStorage.getItem('threads_client_secret') || '');
  
  // Default redirect URI is current origin + pathname
  const defaultRedirectUri = window.location.origin + window.location.pathname;
  const [redirectUri, setRedirectUri] = useState<string>(localStorage.getItem('threads_redirect_uri') || defaultRedirectUri);
  
  const [isMockMode, setIsMockMode] = useState<boolean>(localStorage.getItem('threads_is_mock') === 'true');
  const [showAuthModal, setShowAuthModal] = useState<boolean>(!token);
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'oauth' | 'demo'>('oauth');
  
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Handle URL redirect callback (detecting auth code)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (code) {
      if (code.startsWith('mock_auth_code_')) {
        // Mock authentication simulation
        setAuthLoading(true);
        setError('');
        
        // Remove code from URL immediately to keep it clean
        window.history.replaceState({}, document.title, window.location.pathname);
        
        setTimeout(() => {
          const dummyToken = 'mock_long_lived_token_xyz123';
          setToken(dummyToken);
          localStorage.setItem('threads_token', dummyToken);
          setIsMockMode(true);
          localStorage.setItem('threads_is_mock', 'true');
          setAuthLoading(false);
          setShowAuthModal(false);
        }, 1500); // Simulate network latency for token exchange
      } else {
        // Real Meta Threads OAuth exchange
        // Retrieve credentials from localStorage
        const storedClientId = localStorage.getItem('threads_client_id') || '';
        const storedClientSecret = localStorage.getItem('threads_client_secret') || '';
        const storedRedirectUri = localStorage.getItem('threads_redirect_uri') || defaultRedirectUri;

        if (!storedClientId || !storedClientSecret) {
          setError('Authentication failed: Missing App ID (Client ID) or App Secret.');
          window.history.replaceState({}, document.title, window.location.pathname);
          return;
        }

        exchangeCodeForToken(code, storedClientId, storedClientSecret, storedRedirectUri);
        // Remove code from URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  const exchangeCodeForToken = async (code: string, cId: string, cSecret: string, rUri: string) => {
    setAuthLoading(true);
    setError('');
    try {
      // Step 1: Exchange code for Short-Lived Access Token (1 hour validity)
      // Form parameters according to Threads API spec
      const tokenExchangeBody = new URLSearchParams({
        client_id: cId,
        client_secret: cSecret,
        grant_type: 'authorization_code',
        redirect_uri: rUri,
        code: code
      });

      let shortLivedRes;
      try {
        // Try local development proxy first to bypass CORS
        shortLivedRes = await fetch('/api-threads-oauth/oauth/access_token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: tokenExchangeBody.toString()
        });
      } catch (proxyError) {
        console.warn('Proxy fetch failed. Falling back to direct API request (CORS may apply):', proxyError);
        shortLivedRes = await fetch('https://graph.threads.net/oauth/access_token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: tokenExchangeBody.toString()
        });
      }

      if (!shortLivedRes.ok) {
        const errorText = await shortLivedRes.text();
        let parsedError;
        try { parsedError = JSON.parse(errorText); } catch { parsedError = {}; }
        throw new Error(parsedError.error_message || parsedError.error?.message || `Failed to fetch access token (${shortLivedRes.status})`);
      }

      const shortLivedData = await shortLivedRes.json();
      const shortLivedToken = shortLivedData.access_token;

      // Step 2: Exchange Short-Lived Access Token for Long-Lived Access Token (60 days validity)
      let longLivedRes;
      const longLivedUrlPath = `/access_token?grant_type=th_exchange_token&client_secret=${cSecret}&access_token=${shortLivedToken}`;
      
      try {
        longLivedRes = await fetch(`/api-threads-oauth${longLivedUrlPath}`);
      } catch (proxyError) {
        console.warn('Proxy exchange failed. Falling back to direct exchange:', proxyError);
        longLivedRes = await fetch(`https://graph.threads.net${longLivedUrlPath}`);
      }

      if (!longLivedRes.ok) {
        const errorText = await longLivedRes.text();
        let parsedError;
        try { parsedError = JSON.parse(errorText); } catch { parsedError = {}; }
        throw new Error(parsedError.error_message || parsedError.error?.message || `Failed to exchange for long-lived token (${longLivedRes.status})`);
      }

      const longLivedData = await longLivedRes.json();
      const longLivedToken = longLivedData.access_token;

      // Store results
      setToken(longLivedToken);
      localStorage.setItem('threads_token', longLivedToken);
      setIsMockMode(false);
      localStorage.setItem('threads_is_mock', 'false');
      setShowAuthModal(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'OAuth token exchange failed.');
      setShowAuthModal(true);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleOAuthLoginRedirect = () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      setError('Please fill in both Client ID and Client Secret.');
      return;
    }

    // Save configuration before redirecting
    localStorage.setItem('threads_client_id', clientId.trim());
    localStorage.setItem('threads_client_secret', clientSecret.trim());
    localStorage.setItem('threads_redirect_uri', redirectUri.trim());

    // Build Threads OAuth authorization URL
    // Required Scopes: threads_basic (basic profile/media), threads_manage_insights (insights metrics)
    const scope = 'threads_basic,threads_manage_insights';
    const authUrl = `https://threads.net/oauth/authorize?client_id=${clientId.trim()}&redirect_uri=${encodeURIComponent(redirectUri.trim())}&scope=${scope}&response_type=code`;

    // Redirect user to Threads authorization screen
    window.location.href = authUrl;
  };

  const handleMockLogin = () => {
    // Save dummy credentials so validation is satisfied if edited later
    localStorage.setItem('threads_client_id', 'mock_client_id_123');
    localStorage.setItem('threads_client_secret', 'mock_client_secret_abc');
    localStorage.setItem('threads_redirect_uri', defaultRedirectUri);
    
    // Redirect to self with a mock authorization code parameter
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('code', 'mock_auth_code_' + Math.random().toString(36).substring(2, 9));
    window.location.href = currentUrl.toString();
  };

  const handleLogout = () => {
    setToken('');
    localStorage.removeItem('threads_token');
    localStorage.removeItem('threads_is_mock');
    setPosts([]);
    setError('');
    setIsMockMode(false);
    setShowAuthModal(true);
  };

  const fetchInsights = async () => {
    if (!token) {
      setShowAuthModal(true);
      return;
    }
    
    setLoading(true);
    setError('');
    
    // If mock mode is active, simulate api latency and return high-quality mock insights
    if (isMockMode || token.startsWith('mock_long_lived_token')) {
      setTimeout(() => {
        setPosts([
          { id: '1', text: "Just launched our Threads Analytics Dashboard! 🚀 Fully responsive and styled in dynamic glassmorphism.", timestamp: new Date().toISOString(), views: 2450, likes: 620, replies: 48, reposts: 34, quotes: 12, engagementRate: ((620+48+34+12)/2450)*100 },
          { id: '2', text: "What features would you love to see next in the Threads analytics? Tell me in the replies below! 👇", timestamp: new Date(Date.now() - 86400000).toISOString(), views: 1890, likes: 210, replies: 112, reposts: 18, quotes: 4, engagementRate: ((210+112+18+4)/1890)*100 },
          { id: '3', text: "Meta's new API upgrades are fascinating. Threads OAuth flow provides smooth, secure authentication for user tokens. 🧵", timestamp: new Date(Date.now() - 172800000).toISOString(), views: 4200, likes: 1150, replies: 198, reposts: 145, quotes: 52, engagementRate: ((1150+198+145+52)/4200)*100 },
          { id: '4', text: "Coffee + Clean Code = Productive Saturday morning. ☕💻", timestamp: new Date(Date.now() - 259200000).toISOString(), views: 980, likes: 245, replies: 14, reposts: 6, quotes: 2, engagementRate: ((245+14+6+2)/980)*100 },
          { id: '5', text: "Design systems aren't just colors; they're constraints that foster user delight and velocity. Agree or disagree?", timestamp: new Date(Date.now() - 345600000).toISOString(), views: 1530, likes: 380, replies: 42, reposts: 15, quotes: 8, engagementRate: ((380+42+15+8)/1530)*100 }
        ]);
        setLoading(false);
      }, 1200);
      return;
    }
    
    try {
      // Step 1: Fetch recent posts from Threads API
      const threadsRes = await fetch(`https://graph.threads.net/v1.0/me/threads?fields=id,text,timestamp&access_token=${token}`);
      if (!threadsRes.ok) {
        if (threadsRes.status === 401) {
          // Token expired or invalid
          handleLogout();
          throw new Error('Access Token expired or invalid. Please login again.');
        }
        throw new Error(`Failed to fetch posts. (Status: ${threadsRes.status})`);
      }
      
      const threadsData = await threadsRes.json();
      const latestThreads = (threadsData.data || []).slice(0, 10);
      
      if (latestThreads.length === 0) {
        setPosts([]);
        setLoading(false);
        return;
      }

      // Step 2: Fetch insights for each post
      const postsWithInsights = await Promise.all(
        latestThreads.map(async (post: any) => {
          try {
            const metrics = 'views,likes,replies,reposts,quotes';
            const insightRes = await fetch(`https://graph.threads.net/v1.0/${post.id}/insights?metric=${metrics}&access_token=${token}`);
            
            if (!insightRes.ok) throw new Error('Insights fetch failed');
            
            const insightData = await insightRes.json();
            const getMetric = (name: string) => {
              const item = insightData.data?.find((d: any) => d.name === name);
              return item?.values?.[0]?.value || 0;
            };

            const views = getMetric('views');
            const likes = getMetric('likes');
            const replies = getMetric('replies');
            const reposts = getMetric('reposts');
            const quotes = getMetric('quotes');
            
            const totalEngagement = likes + replies + reposts + quotes;
            const engagementRate = views > 0 ? (totalEngagement / views) * 100 : 0;

            return {
              id: post.id,
              text: post.text || 'No text content',
              timestamp: post.timestamp,
              views,
              likes,
              replies,
              reposts,
              quotes,
              engagementRate
            };
          } catch (e) {
            // Fallback: load post basic info but with zero insights if API fails
            return {
              id: post.id,
              text: post.text || 'No text content',
              timestamp: post.timestamp,
              views: 0, likes: 0, replies: 0, reposts: 0, quotes: 0, engagementRate: 0
            };
          }
        })
      );

      setPosts(postsWithInsights);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred while fetching real data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token && !showAuthModal) {
      fetchInsights();
    }
  }, [token, showAuthModal]);

  // Aggregate stats
  const totalViews = posts.reduce((sum, p) => sum + p.views, 0);
  const totalEngagements = posts.reduce((sum, p) => sum + p.likes + p.replies + p.reposts + p.quotes, 0);
  const avgEngagementRate = posts.length > 0 ? (posts.reduce((sum, p) => sum + p.engagementRate, 0) / posts.length).toFixed(1) : '0.0';

  const formatText = (text: string) => text.length > 50 ? text.substring(0, 50) + '...' : text;
  
  // Format for Chart
  const chartData = posts.map(p => ({
    name: formatText(p.text),
    Views: p.views,
    Engagement: p.engagementRate
  }));

  return (
    <div className="container animate-fade-in">
      {/* OAuth Token Exchange Loading Overlay */}
      {authLoading && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '3rem 2rem' }}>
            <div className="spinner" style={{ width: '50px', height: '50px', borderWidth: '5px', marginBottom: '1.5rem' }} />
            <h3>Authenticating with Threads</h3>
            <p className="text-muted" style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
              Exchanging authorization code for secure access tokens...
            </p>
          </div>
        </div>
      )}

      {/* Connection & Setup Modal */}
      {showAuthModal && !authLoading && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '550px' }}>
            <h2 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={24} color="var(--accent-color)" /> Threads Login Integration
            </h2>
            <p className="text-muted" style={{ marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Connect your Threads account using OAuth 2.0 to access secure insights metrics.
            </p>

            {/* Tabs for setup type */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--panel-border)', marginBottom: '1.5rem' }}>
              <button 
                onClick={() => setActiveTab('oauth')} 
                style={{ 
                  flex: 1, 
                  padding: '10px 0', 
                  background: 'none', 
                  border: 'none', 
                  color: activeTab === 'oauth' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  borderBottom: activeTab === 'oauth' ? '2px solid var(--accent-color)' : 'none',
                  fontWeight: activeTab === 'oauth' ? '600' : '400',
                  cursor: 'pointer'
                }}
              >
                Meta App OAuth
              </button>
              <button 
                onClick={() => setActiveTab('demo')} 
                style={{ 
                  flex: 1, 
                  padding: '10px 0', 
                  background: 'none', 
                  border: 'none', 
                  color: activeTab === 'demo' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  borderBottom: activeTab === 'demo' ? '2px solid var(--accent-color)' : 'none',
                  fontWeight: activeTab === 'demo' ? '600' : '400',
                  cursor: 'pointer'
                }}
              >
                Quick Demo (Mock)
              </button>
            </div>

            {error && (
              <div className="glass-panel" style={{ padding: '0.75rem 1rem', marginBottom: '1rem', borderLeft: '4px solid var(--error-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} color="var(--error-color)" />
                <p style={{ color: 'var(--error-color)', fontSize: '0.85rem' }}>{error}</p>
              </div>
            )}

            {activeTab === 'oauth' ? (
              <div>
                <div className="input-group">
                  <label className="input-label">Threads App Client ID</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="Enter Meta App ID"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">Threads App Client Secret</label>
                  <input 
                    type="password" 
                    className="input-field" 
                    placeholder="Enter Meta App Secret"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">Redirect URI</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={redirectUri}
                    onChange={(e) => setRedirectUri(e.target.value)}
                  />
                  <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                    * Must be registered in your Meta Developer Console settings.
                  </small>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', margin: '1rem 0' }}>
                  <Info size={20} color="var(--text-secondary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    Clicking login will redirect you to Threads Authorization window. Ensure that your Meta App has <strong>threads_basic</strong> and <strong>threads_manage_insights</strong> permissions enabled.
                  </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1.5rem' }}>
                  <button className="btn btn-primary" onClick={handleOAuthLoginRedirect} style={{ width: '100%' }}>
                    Login with Threads
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <p className="text-muted" style={{ marginBottom: '1.5rem', fontSize: '0.9rem', lineHeight: '1.6' }}>
                  No Meta Developer Account setup? Simulate the entire login process, OAuth code callback, and access token exchange flow in sandbox mode.
                </p>
                <button className="btn btn-primary" onClick={handleMockLogin} style={{ width: '100%', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)' }}>
                  Launch Mock Demo
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Dashboard Header */}
      <header className="header">
        <div>
          <h1 className="text-gradient" style={{ fontSize: '2.5rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Activity size={36} color="var(--accent-color)" /> Threads Analytics
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <p className="text-muted">Analyze your recent post performance.</p>
            {token && (
              <span className="badge" style={{ 
                background: isMockMode ? 'rgba(16, 185, 129, 0.1)' : 'rgba(236, 72, 153, 0.1)', 
                color: isMockMode ? 'var(--success-color)' : 'var(--accent-color)'
              }}>
                {isMockMode ? 'Demo Sandbox' : 'Real API Connected'}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {token && (
            <>
              <button className="btn btn-secondary" onClick={() => setShowAuthModal(true)}>
                <Settings size={18} /> Credentials
              </button>
              <button className="btn btn-secondary" onClick={handleLogout} style={{ border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--error-color)' }}>
                <LogOut size={18} /> Log out
              </button>
            </>
          )}
          <button className="btn btn-primary" onClick={fetchInsights} disabled={loading || !token}>
            {loading ? <div className="spinner" /> : <RefreshCw size={18} />}
            {loading ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>
      </header>

      {error && (
        <div className="glass-panel" style={{ padding: '1rem', marginBottom: '2rem', borderLeft: '4px solid var(--error-color)' }}>
          <p style={{ color: 'var(--error-color)' }}>{error}</p>
        </div>
      )}

      {/* Analytics KPI Panels */}
      <div className="grid grid-cols-4 delay-100" style={{ marginBottom: '2.5rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Total Posts</p>
          <h2 style={{ fontSize: '2rem' }}>{posts.length}</h2>
        </div>
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Total Views</p>
          <h2 style={{ fontSize: '2rem' }}>{totalViews.toLocaleString()}</h2>
        </div>
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Total Engagements</p>
          <h2 style={{ fontSize: '2rem' }}>{totalEngagements.toLocaleString()}</h2>
        </div>
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Avg Engagement Rate</p>
          <h2 style={{ fontSize: '2rem', color: 'var(--success-color)' }}>{avgEngagementRate}%</h2>
        </div>
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-2 delay-200" style={{ marginBottom: '2.5rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>Views (Last 10 Posts)</h3>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" tick={{fill: '#94a3b8', fontSize: 12}} tickFormatter={(val) => val.substring(0, 10) + '...'} />
                <YAxis tick={{fill: '#94a3b8', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  itemStyle={{ color: '#ec4899' }}
                />
                <Bar dataKey="Views" fill="url(#colorViews)" radius={[4, 4, 0, 0]} />
                <defs>
                  <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ec4899" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>Engagement Rate (%)</h3>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" tick={{fill: '#94a3b8', fontSize: 12}} tickFormatter={(val) => val.substring(0, 10) + '...'} />
                <YAxis tick={{fill: '#94a3b8', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  itemStyle={{ color: '#10b981' }}
                />
                <Bar dataKey="Engagement" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Posts Details Data Grid */}
      <div className="glass-panel delay-300" style={{ padding: '1.5rem' }}>
        <h3 style={{ marginBottom: '1.5rem' }}>Post Details</h3>
        {posts.length > 0 ? (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>Content</th>
                  <th>Date</th>
                  <th><div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Eye size={14}/> Views</div></th>
                  <th><div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Heart size={14}/> Likes</div></th>
                  <th><div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MessageCircle size={14}/> Replies</div></th>
                  <th><div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Repeat2 size={14}/> Reposts</div></th>
                  <th><div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Quote size={14}/> Quotes</div></th>
                  <th>Engagement</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr key={post.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 500 }}>{formatText(post.text)}</span>
                        {/* If it's a real post (not mock), show external link */}
                        {!isMockMode && !post.id.startsWith('mock') ? (
                          <a href={`https://threads.net/t/${post.id}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-secondary)' }}>
                            <ExternalLink size={14} />
                          </a>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)', cursor: 'default' }}>
                            <ExternalLink size={14} style={{ opacity: 0.3 }} />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-muted">{new Date(post.timestamp).toLocaleDateString()}</td>
                    <td>{post.views.toLocaleString()}</td>
                    <td>{post.likes.toLocaleString()}</td>
                    <td>{post.replies.toLocaleString()}</td>
                    <td>{post.reposts.toLocaleString()}</td>
                    <td>{post.quotes.toLocaleString()}</td>
                    <td>
                      <span className="badge" style={{ 
                        background: 'rgba(16, 185, 129, 0.1)', 
                        color: 'var(--success-color)' 
                      }}>
                        {post.engagementRate.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted" style={{ textAlign: 'center', padding: '2rem 0' }}>No posts found. Start analyzing by fetching data.</p>
        )}
      </div>
    </div>
  );
};

export default App;
