import { useEffect, useState } from "react";
import {
  BookOpen, Download, FileText, LifeBuoy, Megaphone,
  Shield, LogIn, LogOut, Menu, X, Send, Upload,
  Trash2, ExternalLink, RefreshCw, CheckCircle,
  AlertCircle, LayoutDashboard
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "./lib/supabase";

const categories = [
  { id: "guide", label: "Guidelines", icon: BookOpen },
  { id: "download", label: "Downloads", icon: Download },
  { id: "report", label: "Reports", icon: FileText },
  { id: "announcement", label: "Announcements", icon: Megaphone }
];

const emptyResource = {
  title: "",
  description: "",
  content: "",
  type: "guide"
};

function App() {
  const [page, setPage] = useState("home");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [resources, setResources] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [resourceForm, setResourceForm] = useState(emptyResource);
  const [selectedFile, setSelectedFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [supportForm, setSupportForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
    bot_version: ""
  });
  const [loginForm, setLoginForm] = useState({
    email: "",
    password: ""
  });

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    loadResources();

    supabase.auth.getSession().then(({ data }) => {
      checkUser(data.session?.user || null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        checkUser(session?.user || null);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  async function checkUser(currentUser) {
    setUser(currentUser);
    setIsAdmin(false);

    if (!currentUser) {
      setTickets([]);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", currentUser.id)
      .maybeSingle();

    if (!error && data?.role === "admin") {
      setIsAdmin(true);
      loadTickets();
    }
  }

  async function loadResources() {
    if (!supabase) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("resources")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) setMessage(error.message);
    else setResources(data || []);

    setLoading(false);
  }

  async function loadTickets() {
    if (!supabase) return;

    const { data, error } = await supabase
      .from("support_tickets")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error) setTickets(data || []);
  }

  function navigate(nextPage) {
    setPage(nextPage);
    setMobileMenu(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
    setMessage("");
  }

  async function submitSupport(event) {
    event.preventDefault();
    if (!supabase) return;

    setSaving(true);
    setMessage("");

    const { error } = await supabase.from("support_tickets").insert({
      name: supportForm.name.trim(),
      email: supportForm.email.trim(),
      subject: supportForm.subject.trim(),
      message: supportForm.message.trim(),
      bot_version: supportForm.bot_version.trim() || null
    });

    setSaving(false);

    if (error) {
      setMessage("সমস্যা জমা হয়নি: " + error.message);
      return;
    }

    setSupportForm({
      name: "",
      email: "",
      subject: "",
      message: "",
      bot_version: ""
    });
    setMessage("তোমার Support Request সফলভাবে জমা হয়েছে।");
  }

  async function signIn(event) {
    event.preventDefault();
    if (!supabase) return;

    setSaving(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email: loginForm.email.trim(),
      password: loginForm.password
    });

    setSaving(false);

    if (error) setMessage(error.message);
    else setMessage("Login request সম্পন্ন হয়েছে।");
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setIsAdmin(false);
    setUser(null);
    navigate("home");
  }

  async function addResource(event) {
    event.preventDefault();
    if (!supabase || !isAdmin) return;

    setSaving(true);
    setMessage("");

    let fileUrl = null;
    let filePath = null;

    try {
      if (selectedFile) {
        const safeName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        filePath = `${Date.now()}-${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from("portal-files")
          .upload(filePath, selectedFile, {
            cacheControl: "3600",
            upsert: false
          });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from("portal-files")
          .getPublicUrl(filePath);

        fileUrl = data.publicUrl;
      }

      const { error } = await supabase.from("resources").insert({
        title: resourceForm.title.trim(),
        description: resourceForm.description.trim(),
        content: resourceForm.content.trim() || null,
        type: resourceForm.type,
        file_url: fileUrl,
        file_path: filePath,
        is_published: true,
        created_by: user.id
      });

      if (error) {
        if (filePath) {
          await supabase.storage.from("portal-files").remove([filePath]);
        }
        throw error;
      }

      setResourceForm(emptyResource);
      setSelectedFile(null);
      event.target.reset();
      setMessage("Resource সফলভাবে প্রকাশ করা হয়েছে।");
      await loadResources();
    } catch (error) {
      setMessage("প্রকাশ করা যায়নি: " + error.message);
    }

    setSaving(false);
  }

  async function deleteResource(resource) {
    if (!isAdmin || !confirm("এই Resource মুছে ফেলতে চাও?")) return;

    const { error } = await supabase
      .from("resources")
      .delete()
      .eq("id", resource.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (resource.file_path) {
      await supabase.storage
        .from("portal-files")
        .remove([resource.file_path]);
    }

    setMessage("Resource মুছে ফেলা হয়েছে।");
    loadResources();
  }

  async function updateTicket(ticketId, status) {
    const { error } = await supabase
      .from("support_tickets")
      .update({ status })
      .eq("id", ticketId);

    if (error) setMessage(error.message);
    else loadTickets();
  }

  function ResourceCard({ item }) {
    const category = categories.find((c) => c.id === item.type);
    const Icon = category?.icon || FileText;

    return (
      <article className="resource-card">
        <div className="resource-icon"><Icon size={23} /></div>
        <span className="tag">{category?.label || item.type}</span>
        <h3>{item.title}</h3>
        {item.description && <p>{item.description}</p>}
        {item.content && (
          <div className="resource-content">{item.content}</div>
        )}
        {item.file_url && (
          <a
            className="button button-small"
            href={item.file_url}
            target="_blank"
            rel="noreferrer"
          >
            <Download size={16} /> Download File
          </a>
        )}
        {isAdmin && (
          <button
            className="delete-button"
            onClick={() => deleteResource(item)}
            type="button"
          >
            <Trash2 size={15} /> Delete
          </button>
        )}
        <small className="date">
          {new Date(item.created_at).toLocaleDateString()}
        </small>
      </article>
    );
  }

  const shownResources = (type) =>
    resources.filter((item) => item.type === type);

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => navigate("home")}>
          <span className="brand-mark">404</span>
          <span>NU 404 BOT</span>
        </button>

        <button
          className="menu-toggle"
          onClick={() => setMobileMenu(!mobileMenu)}
          aria-label="Toggle menu"
        >
          {mobileMenu ? <X /> : <Menu />}
        </button>

        <nav className={mobileMenu ? "nav open" : "nav"}>
          <button onClick={() => navigate("home")}>Home</button>
          <button onClick={() => navigate("guides")}>Guidelines</button>
          <button onClick={() => navigate("downloads")}>Downloads</button>
          <button onClick={() => navigate("reports")}>Reports</button>
          <button onClick={() => navigate("support")}>Support</button>
          {isAdmin ? (
            <button className="nav-admin" onClick={() => navigate("admin")}>
              <LayoutDashboard size={16} /> Admin
            </button>
          ) : (
            <button className="nav-admin" onClick={() => navigate("login")}>
              <LogIn size={16} /> Admin Login
            </button>
          )}
        </nav>
      </header>

      {!isSupabaseConfigured && (
        <div className="notice error">
          Supabase এখনো Configure করা হয়নি। .env সেটিংস যোগ করতে হবে।
        </div>
      )}

      {message && (
        <div className="notice" role="status">
          {message}
          <button onClick={() => setMessage("")} aria-label="Close">
            <X size={16} />
          </button>
        </div>
      )}

      {page === "home" && (
        <>
          <section className="hero">
            <span className="eyebrow">OFFICIAL RESOURCE CENTER</span>
            <h1>
              Everything about <span>NU 404 BOT</span>
            </h1>
            <p>
              Bot documentation, helpful resources, downloads,
              reports and support — all in one place.
            </p>
            <button
              className="button"
              onClick={() => navigate("guides")}
            >
              Explore Resources <ExternalLink size={17} />
            </button>
          </section>

          <section className="section">
            <div className="section-title">
              <span className="eyebrow">RESOURCE CENTER</span>
              <h2>Explore Our Resources</h2>
              <p>Everything you need to use the bot.</p>
            </div>

            <div className="category-grid">
              {categories.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    className="category-card"
                    key={item.id}
                    onClick={() =>
                      navigate(
                        item.id === "guide" ? "guides" :
                        item.id === "download" ? "downloads" : "reports"
                      )
                    }
                  >
                    <Icon size={27} />
                    <h3>{item.label}</h3>
                    <p>Explore {item.label.toLowerCase()} and resources.</p>
                    <span>Open section →</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="support-banner">
            <LifeBuoy size={32} />
            <h2>Need Help?</h2>
            <p>Send your problem to our support team.</p>
            <button className="button button-light" onClick={() => navigate("support")}>
              Contact Support
            </button>
          </section>
        </>
      )}

      {["guides", "downloads", "reports"].includes(page) && (
        <section className="section page-section">
          <div className="section-title">
            <span className="eyebrow">NU 404 BOT RESOURCES</span>
            <h2>
              {page === "guides" ? "Guidelines" :
               page === "downloads" ? "Downloads" : "Reports & Updates"}
            </h2>
            <p>Official information and resources.</p>
          </div>

          {loading ? (
            <div className="empty"><RefreshCw className="spin" /> Loading...</div>
          ) : (
            <div className="resource-grid">
              {(page === "guides" ? shownResources("guide") :
                page === "downloads" ? shownResources("download") :
                [...shownResources("report"), ...shownResources("announcement")]
              ).map((item) => (
                <ResourceCard item={item} key={item.id} />
              ))}
            </div>
          )}

          {!loading && (
            (page === "guides" ? shownResources("guide") :
             page === "downloads" ? shownResources("download") :
             [...shownResources("report"), ...shownResources("announcement")]
            ).length === 0 && (
              <div className="empty">এখনো কোনো Resource প্রকাশ করা হয়নি।</div>
            )
          )}
        </section>
      )}

      {page === "support" && (
        <section className="form-section">
          <div className="section-title">
            <span className="eyebrow">WE ARE HERE TO HELP</span>
            <h2>Report a Problem</h2>
            <p>তোমার সমস্যার বিস্তারিত লিখে পাঠাও।</p>
          </div>

          <form className="panel-form" onSubmit={submitSupport}>
            <label>
              তোমার নাম
              <input
                required
                maxLength="100"
                value={supportForm.name}
                onChange={(e) => setSupportForm({
                  ...supportForm, name: e.target.value
                })}
                placeholder="Your name"
              />
            </label>

            <label>
              Email Address
              <input
                required
                type="email"
                maxLength="200"
                value={supportForm.email}
                onChange={(e) => setSupportForm({
                  ...supportForm, email: e.target.value
                })}
                placeholder="you@example.com"
              />
            </label>

            <label>
              Bot Version (Optional)
              <input
                maxLength="50"
                value={supportForm.bot_version}
                onChange={(e) => setSupportForm({
                  ...supportForm, bot_version: e.target.value
                })}
                placeholder="e.g. 1.5.35"
              />
            </label>

            <label>
              সমস্যার শিরোনাম
              <input
                required
                maxLength="150"
                value={supportForm.subject}
                onChange={(e) => setSupportForm({
                  ...supportForm, subject: e.target.value
                })}
                placeholder="Problem subject"
              />
            </label>

            <label>
              সমস্যার বিস্তারিত
              <textarea
                required
                minLength="10"
                maxLength="5000"
                rows="6"
                value={supportForm.message}
                onChange={(e) => setSupportForm({
                  ...supportForm, message: e.target.value
                })}
                placeholder="Describe your problem..."
              />
            </label>

            <button className="button full-button" disabled={saving}>
              <Send size={17} />
              {saving ? "Sending..." : "Submit Problem"}
            </button>
          </form>
        </section>
      )}

      {page === "login" && (
        <section className="form-section">
          <div className="section-title">
            <Shield size={34} />
            <h2>Admin Login</h2>
            <p>Authorized administrators only.</p>
          </div>

          <form className="panel-form" onSubmit={signIn}>
            <label>
              Email
              <input
                required
                type="email"
                value={loginForm.email}
                onChange={(e) => setLoginForm({
                  ...loginForm, email: e.target.value
                })}
              />
            </label>
            <label>
              Password
              <input
                required
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({
                  ...loginForm, password: e.target.value
                })}
              />
            </label>
            <button className="button full-button" disabled={saving}>
              <LogIn size={17} />
              {saving ? "Signing in..." : "Login"}
            </button>
          </form>
        </section>
      )}

      {page === "admin" && (
        <section className="section page-section">
          {!user || !isAdmin ? (
            <div className="empty">
              <AlertCircle />
              Admin permission required.
              <button className="button" onClick={() => navigate("login")}>
                Admin Login
              </button>
            </div>
          ) : (
            <>
              <div className="admin-heading">
                <div>
                  <span className="eyebrow">CONTROL CENTER</span>
                  <h2>Admin Dashboard</h2>
                  <p>{user.email}</p>
                </div>
                <button className="button button-danger" onClick={signOut}>
                  <LogOut size={16} /> Logout
                </button>
              </div>

              <div className="stats-grid">
                <div className="stat-card">
                  <FileText />
                  <strong>{resources.length}</strong>
                  <span>Resources</span>
                </div>
                <div className="stat-card">
                  <LifeBuoy />
                  <strong>{tickets.length}</strong>
                  <span>Support Tickets</span>
                </div>
                <div className="stat-card">
                  <CheckCircle />
                  <strong>{tickets.filter(t => t.status === "solved").length}</strong>
                  <span>Solved Tickets</span>
                </div>
              </div>

              <div className="admin-panel">
                <h3><Upload size={20} /> Publish New Resource</h3>
                <form className="panel-form" onSubmit={addResource}>
                  <label>
                    Resource Type
                    <select
                      value={resourceForm.type}
                      onChange={(e) => setResourceForm({
                        ...resourceForm, type: e.target.value
                      })}
                    >
                      <option value="guide">Guideline</option>
                      <option value="download">Download</option>
                      <option value="report">Report</option>
                      <option value="announcement">Announcement</option>
                    </select>
                  </label>

                  <label>
                    Title
                    <input
                      required
                      maxLength="180"
                      value={resourceForm.title}
                      onChange={(e) => setResourceForm({
                        ...resourceForm, title: e.target.value
                      })}
                      placeholder="Resource title"
                    />
                  </label>

                  <label>
                    Short Description
                    <textarea
                      rows="2"
                      maxLength="500"
                      value={resourceForm.description}
                      onChange={(e) => setResourceForm({
                        ...resourceForm, description: e.target.value
                      })}
                      placeholder="Short description"
                    />
                  </label>

                  <label>
       
