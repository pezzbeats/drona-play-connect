import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/admin/ProtectedRoute";
import { ErrorBoundary } from "@/components/admin/ErrorBoundary";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { VoiceAgent } from "@/components/VoiceAgent";

const HIDE_VOICE_AGENT_PATHS = ["/register", "/ticket", "/play", "/live"];

function VoiceAgentGuard() {
  const location = useLocation();
  if (
    HIDE_VOICE_AGENT_PATHS.includes(location.pathname) ||
    location.pathname.startsWith('/admin')
  ) return null;
  return <VoiceAgent />;
}

import Index from "./pages/Index";
import TermsPage from "./pages/Terms";
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
import AdminRoles from "./pages/admin/AdminRoles";
import AdminSiteConfig from "./pages/admin/AdminSiteConfig";
import AdminPayments from "./pages/admin/AdminPayments";
import AdminEligibility from "./pages/admin/AdminEligibility";
import AdminTrialGame from "./pages/admin/AdminTrialGame";
import AdminCoupons from "./pages/admin/AdminCoupons";
import AdminCouponScan from "./pages/admin/AdminCouponScan";
import AdminOverallLeaderboard from "./pages/admin/AdminOverallLeaderboard";
import AboutPage from "./pages/About";
import PrivacyPolicyPage from "./pages/PrivacyPolicy";
import RefundPolicyPage from "./pages/RefundPolicy";
import EventParticipationTermsPage from "./pages/EventParticipationTerms";
import DisclaimerPolicyPage from "./pages/DisclaimerPolicy";
import ContactUsPage from "./pages/ContactUs";
import PricingPolicyPage from "./pages/PricingPolicy";
import ShippingPolicyPage from "./pages/ShippingPolicy";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <VoiceAgentGuard />
          <Routes>
            {/* Public */}
            <Route path="/" element={<Index />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/ticket" element={<TicketPage />} />
            <Route path="/play" element={<PlayPage />} />
            <Route path="/live" element={<LivePage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/refund-policy" element={<RefundPolicyPage />} />
            <Route path="/event-terms" element={<EventParticipationTermsPage />} />
            <Route path="/disclaimer" element={<DisclaimerPolicyPage />} />
            <Route path="/contact" element={<ContactUsPage />} />
            <Route path="/pricing" element={<PricingPolicyPage />} />
            <Route path="/shipping" element={<ShippingPolicyPage />} />

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
              <Route path="site-config" element={<ProtectedRoute requiredRole="operator"><AdminSiteConfig /></ProtectedRoute>} />
              <Route path="payments" element={<ProtectedRoute requiredRole="operator"><AdminPayments /></ProtectedRoute>} />
              {/* super_admin only */}
              <Route path="leaderboard" element={<ProtectedRoute requiredRole="super_admin"><AdminLeaderboard /></ProtectedRoute>} />
              <Route path="activity" element={<ProtectedRoute requiredRole="super_admin"><AdminActivity /></ProtectedRoute>} />
              <Route path="roles" element={<ProtectedRoute requiredRole="super_admin"><AdminRoles /></ProtectedRoute>} />
              <Route path="eligibility" element={<ProtectedRoute requiredRole="super_admin"><AdminEligibility /></ProtectedRoute>} />
              <Route path="trial-game" element={<ProtectedRoute requiredRole="operator"><AdminTrialGame /></ProtectedRoute>} />
              <Route path="coupons" element={<ProtectedRoute requiredRole="operator"><AdminCoupons /></ProtectedRoute>} />
              <Route path="coupon-scan" element={<ProtectedRoute requiredRole="operator"><AdminCouponScan /></ProtectedRoute>} />
              <Route path="overall-leaderboard" element={<ProtectedRoute requiredRole="operator"><AdminOverallLeaderboard /></ProtectedRoute>} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
