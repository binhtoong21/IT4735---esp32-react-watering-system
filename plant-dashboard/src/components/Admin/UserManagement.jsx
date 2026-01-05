import React, { useState, useEffect } from "react";
import { database, app as mainApp } from "../../firebase";
import { ref, onValue, set, update } from "firebase/database";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import "./UserManagement.css";

function UserManagement({ onBack }) {
  const [users, setUsers] = useState({});
  const [loading, setLoading] = useState(true);
  const [newUser, setNewUser] = useState({ email: "", password: "", role: "user" });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const usersRef = ref(database, "users");
    const unsubscribe = onValue(usersRef, (snapshot) => {
      setUsers(snapshot.val() || {});
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError("");

    // Secondary App Initialization to prevent logging out the admin
    let secondaryApp;
    try {
      secondaryApp = initializeApp(mainApp.options, "Secondary");
      const secondaryAuth = getAuth(secondaryApp);
      
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth, 
        newUser.email, 
        newUser.password
      );
      
      const newUid = userCredential.user.uid;
      
      // Save user details to Realtime Databse
      await set(ref(database, `users/${newUid}`), {
        email: newUser.email,
        role: newUser.role,
        isDisabled: false,
        createdAt: new Date().toISOString()
      });

      // Cleanup
      await signOut(secondaryAuth);
      setNewUser({ email: "", password: "", role: "user" });
      alert("Tạo người dùng thành công!");

    } catch (err) {
      console.error(err);
      setError("Lỗi tạo người dùng: " + err.message);
    } finally {
      if (secondaryApp) {
        await deleteApp(secondaryApp);
      }
      setCreating(false);
    }
  };

  const toggleDisableUser = async (uid, currentStatus) => {
    try {
      await update(ref(database, `users/${uid}`), {
        isDisabled: !currentStatus
      });
    } catch (err) {
      alert("Lỗi cập nhật trạng thái: " + err.message);
    }
  };

  return (
    <div className="user-management">
      <div className="um-header">
        <button className="btn btn--secondary" onClick={onBack}>← Quay lại Dashboard</button>
        <h2>Quản lý người dùng</h2>
      </div>

      <div className="um-grid">
        {/* CREATE USER CARD */}
        <div className="um-card">
          <h3>Thêm người dùng mới</h3>
          <form onSubmit={handleCreateUser}>
            <div className="form-group">
              <label>Email</label>
              <input 
                type="email" 
                required 
                value={newUser.email}
                onChange={e => setNewUser({...newUser, email: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Mật khẩu</label>
              <input 
                type="password" 
                required 
                minLength={6}
                value={newUser.password}
                onChange={e => setNewUser({...newUser, password: e.target.value})}
              />
            </div>
            <div className="form-group" style={{ display: "none" }}>
              <input type="hidden" value="user" />
            </div>
            {error && <p className="error-text">{error}</p>}
            <button type="submit" className="btn btn--primary" disabled={creating}>
              {creating ? "Đang tạo..." : "Tạo tài khoản"}
            </button>
          </form>
        </div>

        {/* LIST USERS CARD */}
        <div className="um-card um-list-card">
          <h3>Danh sách tài khoản</h3>
          {loading ? <p>Đang tải...</p> : (
            <div className="table-responsive">
              <table className="user-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Vai trò</th>
                    <th>Trạng thái</th>
                    <th>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(users).map(([uid, user]) => (
                    <tr key={uid} className={user.isDisabled ? "row-disabled" : ""}>
                      <td>{user.email}</td>
                      <td>
                        <span className={`badge badge--${user.role}`}>
                          {user.role}
                        </span>
                      </td>
                      <td>
                        {user.isDisabled ? 
                          <span className="status-off">Đã khóa</span> : 
                          <span className="status-on">Hoạt động</span>
                        }
                      </td>
                      <td>
                        <button 
                          className="btn btn--small btn--danger"
                          onClick={() => toggleDisableUser(uid, user.isDisabled)}
                        >
                          {user.isDisabled ? "Mở khóa" : "Khóa"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default UserManagement;
