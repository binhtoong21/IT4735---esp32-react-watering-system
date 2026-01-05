import React from "react";
import "./Header.css";

function Header({ onLogout, userRole, onManageUsers }) {
  return (
    <header className="app__header">
      <div className="app__title-block">
        <h1>🌱 Hệ thống tưới cây thông minh</h1>
        <p className="app__subtitle">Theo dõi độ ẩm đất và điều khiển bơm theo thời gian thực</p>
      </div>
      <div className="header-actions">
        {userRole === 'admin' && (
          <button type="button" className="btn btn--secondary" onClick={onManageUsers}>
            Quản lý Users
          </button>
        )}
        <button type="button" className="btn btn--ghost" onClick={onLogout}>
          Đăng xuất
        </button>
      </div>
    </header>
  );
}

export default Header;
