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
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        setAuthError("Email hoặc mật khẩu không chính xác.");
      } else if (error.code === 'auth/too-many-requests') {
        setAuthError("Quá nhiều lần thử thất bại. Vui lòng thử lại sau.");
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

          {authError && <div className="auth-error">{authError}</div>}

          <button type="submit" className="btn btn--primary" disabled={isLoginDisabled}>
            {isLoading ? "Đang xử lý..." : "Đăng nhập"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
