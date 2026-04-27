import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Shell from "./components/Shell";
import Login from "./pages/Login";
import Home from "./pages/Home";
import CatalogPage from "./pages/CatalogPage";
import SeriesDetail from "./pages/SeriesDetail";
import Favorites from "./pages/Favorites";
import Search from "./pages/Search";
import Player from "./pages/Player";

function Guard({ children }) {
  const { isAuthed } = useAuth();
  if (!isAuthed) return <Navigate to="/login" replace />;
  return children;
}

function Shelled({ children }) {
  return <Shell>{children}</Shell>;
}

export default function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <Guard>
                  <Shelled>
                    <Home />
                  </Shelled>
                </Guard>
              }
            />
            <Route
              path="/live"
              element={
                <Guard>
                  <Shelled>
                    <CatalogPage type="live" />
                  </Shelled>
                </Guard>
              }
            />
            <Route
              path="/movies"
              element={
                <Guard>
                  <Shelled>
                    <CatalogPage type="vod" />
                  </Shelled>
                </Guard>
              }
            />
            <Route
              path="/series"
              element={
                <Guard>
                  <Shelled>
                    <CatalogPage type="series" />
                  </Shelled>
                </Guard>
              }
            />
            <Route
              path="/series/:id"
              element={
                <Guard>
                  <Shelled>
                    <SeriesDetail />
                  </Shelled>
                </Guard>
              }
            />
            <Route
              path="/favorites"
              element={
                <Guard>
                  <Shelled>
                    <Favorites />
                  </Shelled>
                </Guard>
              }
            />
            <Route
              path="/search"
              element={
                <Guard>
                  <Shelled>
                    <Search />
                  </Shelled>
                </Guard>
              }
            />
            <Route
              path="/player/:type/:id"
              element={
                <Guard>
                  <Player />
                </Guard>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster theme="dark" richColors position="top-right" />
      </AuthProvider>
    </div>
  );
}
