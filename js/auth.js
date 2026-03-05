/**
 * FinanzApp — Supabase Auth (GitHub OAuth)
 */
const SUPABASE_URL = 'https://mcgatnjwroqldregdcwy.supabase.co';
const SUPABASE_KEY = 'sb_publishable_77THR9_xDm_m_puJz6kK2w_quVM6gXD';

const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const Auth = {
  session: null,

  async init(onAuthenticated) {
    const { data: { session } } = await _sb.auth.getSession();
    this.session = session;

    if (session) {
      this._showApp();
      onAuthenticated(session);
    } else {
      this._showLogin();
    }

    _sb.auth.onAuthStateChange((_event, session) => {
      this.session = session;
      if (session) {
        this._showApp();
        onAuthenticated(session);
      } else {
        this._showLogin();
      }
    });
  },

  _showLogin() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('github-login-btn').onclick = () => this.signInWithGitHub();
  },

  _showApp() {
    document.getElementById('login-screen').classList.add('hidden');
  },

  async signInWithGitHub() {
    const btn = document.getElementById('github-login-btn');
    btn.disabled = true;
    btn.querySelector('span').textContent = 'Conectando...';

    const redirectTo = location.origin + location.pathname;
    await _sb.auth.signInWithOAuth({ provider: 'github', options: { redirectTo } });
  },

  async signOut() {
    await _sb.auth.signOut();
    location.reload();
  },

  getUser() {
    return this.session?.user || null;
  },
};
