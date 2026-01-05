import React, { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import "./Login.css";

function Login() {
  const { login } = useAuth();
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [authError, setAuthError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleCredentialChange = (event) => {
    const { name, value } = event.target;
    setCredentials(prev => ({ ...prev, [name]: value }));
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setAuthError("");

    const enteredEmail = credentials.email.trim();
    const enteredPassword = credentials.password.trim();

    if (!enteredEmail || !enteredPassword) {
      setAuthError("Vui lòng nhập đầy đủ thông tin.");
      setIsLoading(false);
      return;
    }

    try {
      await login(enteredEmail, enteredPassword);
      // Login success is handled by AuthContext state change in App.jsx
    } catch (error) {
      console.error("Login Result:", error);
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setAuthError("Email hoặc mật khẩu không chính xác.");
      } else if (error.code === 'auth/too-many-requests') {
        setAuthError("Quá nhiều lần thử thất bại. Vui lòng thử lại sau.");
      } else if (error.message === 'ACCOUNT_LOCKED') {
        setAuthError("Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Admin.");
      } else {
        setAuthError("Đăng nhập thất bại: " + error.message);
      }
    }
    setIsLoading(false);
  };

  const isLoginDisabled = !credentials.email.trim() || !credentials.password.trim() || isLoading;

  return (
    <div className="auth-gate">
      <div className="auth-card">
        <h1>🌱 Hệ thống tưới cây thông minh</h1>
        <p className="auth-card__subtitle">Đăng nhập để truy cập bảng điều khiển.</p>

        <form className="auth-card__form" onSubmit={handleLogin}>
          <label className="auth-card__field" htmlFor="auth-email">
            <span>Email</span>
            <input
              id="auth-email"
              name="email"
              type="email"
              className="control-input"
              placeholder="admin@smartgrower.com"
              autoComplete="email"
              value={credentials.email}
              onChange={handleCredentialChange}
              required
            />
          </label>

          <label className="auth-card__field" htmlFor="auth-password">
            <span>Mật khẩu</span>
            <input
              id="auth-password"
              name="password"
              type="password"
              className="control-input"
              placeholder="Nhập mật khẩu"
              autoComplete="current-password"
              value={credentials.password}
              onChange={handleCredentialChange}
              required
            />
          </label>

          {authError && (
            <div className={`auth-error ${authError.toLowerCase().includes("khóa") ? "locked" : ""}`}>
              {authError.toLowerCase().includes("khóa") ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              )}
              <span>{authError}</span>
            </div>
          )}

          <button type="submit" className="btn btn--primary" disabled={isLoginDisabled}>
            {isLoading ? "Đang xử lý..." : "Đăng nhập"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
