import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/admin/ProtectedRoute";
import { ErrorBoundary } from "@/components/admin/ErrorBoundary";
import { AdminLayout } from "@/components/admin/AdminLayout";

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import RegisterPage from "./pages/Register";
import TicketPage from "./pages/Ticket";
import PlayPage from "./pages/Play";
import LivePage from "./pages/Live";
import AdminLoginPage from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminMatches from "./pages/admin/AdminMatches";
import AdminMatchDetail from "./pages/admin/AdminMatchDetail";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminValidate from "./pages/admin/AdminValidate";
import AdminManualBooking from "./pages/admin/AdminManualBooking";
import AdminControl from "./pages/admin/AdminControl";
import AdminTeams from "./pages/admin/AdminTeams";
import AdminLeaderboard from "./pages/admin/AdminLeaderboard";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminActivity from "./pages/admin/AdminActivity";
import AdminHealth from "./pages/admin/AdminHealth";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public */}
            <Route path="/" element={<Navigate to="/register" replace />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/ticket" element={<TicketPage />} />
            <Route path="/play" element={<PlayPage />} />
            <Route path="/live" element={<LivePage />} />

            {/* Admin Auth */}
            <Route path="/admin/login" element={<AdminLoginPage />} />

            {/* Admin Protected */}
            <Route
              path="/admin"
              element={
                <ErrorBoundary>
                  <ProtectedRoute>
                    <AdminLayout />
                  </ProtectedRoute>
                </ErrorBoundary>
              }
            >
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              {/* gate_staff + operator + super_admin */}
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="validate" element={<AdminValidate />} />
              {/* operator + super_admin */}
              <Route path="matches" element={<ProtectedRoute requiredRole="operator"><AdminMatches /></ProtectedRoute>} />
              <Route path="matches/:id" element={<ProtectedRoute requiredRole="operator"><AdminMatchDetail /></ProtectedRoute>} />
              <Route path="orders" element={<ProtectedRoute requiredRole="operator"><AdminOrders /></ProtectedRoute>} />
              <Route path="manual-booking" element={<ProtectedRoute requiredRole="operator"><AdminManualBooking /></ProtectedRoute>} />
              <Route path="control" element={<ProtectedRoute requiredRole="operator"><AdminControl /></ProtectedRoute>} />
              <Route path="teams" element={<ProtectedRoute requiredRole="operator"><AdminTeams /></ProtectedRoute>} />
              <Route path="analytics" element={<ProtectedRoute requiredRole="operator"><AdminAnalytics /></ProtectedRoute>} />
              <Route path="health" element={<ProtectedRoute requiredRole="operator"><AdminHealth /></ProtectedRoute>} />
              {/* super_admin only */}
              <Route path="leaderboard" element={<ProtectedRoute requiredRole="super_admin"><AdminLeaderboard /></ProtectedRoute>} />
              <Route path="activity" element={<ProtectedRoute requiredRole="super_admin"><AdminActivity /></ProtectedRoute>} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
