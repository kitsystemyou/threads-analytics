import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Activity, RefreshCw, Key, MessageCircle, Heart, Repeat2, Eye, Quote, ExternalLink } from 'lucide-react';

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
  const [showTokenModal, setShowTokenModal] = useState<boolean>(!token);
  const [tempToken, setTempToken] = useState<string>('');
  
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const saveToken = () => {
    if (tempToken.trim()) {
      setToken(tempToken);
      localStorage.setItem('threads_token', tempToken);
      setShowTokenModal(false);
    }
  };

  const clearToken = () => {
    setToken('');
    localStorage.removeItem('threads_token');
    setPosts([]);
    setShowTokenModal(true);
  };

  const fetchInsights = async () => {
    if (!token) {
      setShowTokenModal(true);
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // Step 1: Fetch recent posts
      // Note: We use graph.threads.net based on official Meta API
      const threadsRes = await fetch(`https://graph.threads.net/v1.0/me/threads?fields=id,text,timestamp&access_token=${token}`);
      if (!threadsRes.ok) throw new Error('Failed to fetch posts. Please check your Access Token.');
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
            // Fallback for demo if API fails or post lacks insight permissions
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
      setError(err.message || 'An error occurred while fetching data.');
      
      // If we get an error (e.g., CORS or invalid token), load some beautiful mock data to show the UI
      setPosts([
        { id: '1', text: "Just launched my new portfolio! 🚀", timestamp: new Date().toISOString(), views: 1205, likes: 340, replies: 25, reposts: 15, quotes: 5, engagementRate: ((340+25+15+5)/1205)*100 },
        { id: '2', text: "What's everyone working on this weekend?", timestamp: new Date(Date.now() - 86400000).toISOString(), views: 890, likes: 120, replies: 45, reposts: 2, quotes: 1, engagementRate: ((120+45+2+1)/890)*100 },
        { id: '3', text: "React vs Vue in 2026. My thoughts... 🧵", timestamp: new Date(Date.now() - 172800000).toISOString(), views: 2400, likes: 850, replies: 120, reposts: 85, quotes: 30, engagementRate: ((850+120+85+30)/2400)*100 },
        { id: '4', text: "Coffee is the only valid design pattern. ☕", timestamp: new Date(Date.now() - 259200000).toISOString(), views: 500, likes: 95, replies: 8, reposts: 0, quotes: 0, engagementRate: ((95+8)/500)*100 }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token && !showTokenModal) {
      fetchInsights();
    }
  }, [token, showTokenModal]);

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
      {showTokenModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Key size={24} color="var(--accent-color)" /> API Setup
            </h2>
            <p className="text-muted" style={{ marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              To fetch your Threads insights without a backend, please provide your Threads API Access Token. Your token is only stored locally in your browser.
            </p>
            <div className="input-group">
              <label className="input-label">Access Token</label>
              <input 
                type="password" 
                className="input-field" 
                placeholder="EAA..."
                value={tempToken}
                onChange={(e) => setTempToken(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1.5rem' }}>
              <button className="btn btn-primary" onClick={saveToken}>Save Token</button>
            </div>
          </div>
        </div>
      )}

      <header className="header">
        <div>
          <h1 className="text-gradient" style={{ fontSize: '2.5rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Activity size={36} color="var(--accent-color)" /> Threads Analytics
          </h1>
          <p className="text-muted">Analyze your recent post performance.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-secondary" onClick={clearToken}>
            <Key size={18} /> Token
          </button>
          <button className="btn btn-primary" onClick={fetchInsights} disabled={loading}>
            {loading ? <div className="spinner" /> : <RefreshCw size={18} />}
            {loading ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>
      </header>

      {error && (
        <div className="glass-panel" style={{ padding: '1rem', marginBottom: '2rem', borderLeft: '4px solid var(--error-color)' }}>
          <p style={{ color: 'var(--error-color)' }}>{error} - Displaying mockup data for demonstration.</p>
        </div>
      )}

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
                        <a href={`https://threads.net/t/${post.id}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-secondary)' }}>
                          <ExternalLink size={14} />
                        </a>
                      </div>
                    </td>
                    <td className="text-muted">{new Date(post.timestamp).toLocaleDateString()}</td>
                    <td>{post.views.toLocaleString()}</td>
                    <td>{post.likes.toLocaleString()}</td>
                    <td>{post.replies.toLocaleString()}</td>
                    <td>{post.reposts.toLocaleString()}</td>
                    <td>{post.quotes.toLocaleString()}</td>
                    <td>
                      <span className="badge">
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
