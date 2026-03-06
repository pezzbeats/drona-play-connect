import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/admin/ProtectedRoute";
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
            <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="matches" element={<AdminMatches />} />
              <Route path="matches/:id" element={<AdminMatchDetail />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route path="validate" element={<AdminValidate />} />
              <Route path="manual-booking" element={<AdminManualBooking />} />
              <Route path="control" element={<AdminControl />} />
              <Route path="teams" element={<AdminTeams />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
