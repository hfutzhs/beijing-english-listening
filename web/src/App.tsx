import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { TabBar } from './components/TabBar';
import PracticeList from './pages/PracticeList';
import PracticeAnswer from './pages/PracticeAnswer';
import ExamMock from './pages/ExamMock';
import ExamFlow from './pages/ExamFlow';
import History from './pages/History';
import HistoryDetail from './pages/HistoryDetail';
import ScoringGuide from './pages/ScoringGuide';

// Routes where the bottom TabBar should be hidden (full-screen experiences)
const FULLSCREEN_ROUTES = ['/practice-answer', '/exam-flow', '/scoring-guide', '/history-detail'];

function AppLayout() {
  const location = useLocation();
  const hideTabBar = FULLSCREEN_ROUTES.some(route => location.pathname.startsWith(route));

  return (
    <div style={{ paddingBottom: hideTabBar ? 0 : 56 }}>
      <Routes>
        <Route path="/" element={<Navigate to="/practice/listen_choose" replace />} />
        <Route path="/practice/:type" element={<PracticeList />} />
        <Route path="/practice-answer" element={<PracticeAnswer />} />
        <Route path="/exam" element={<ExamMock />} />
        <Route path="/exam-flow" element={<ExamFlow />} />
        <Route path="/history" element={<History />} />
        <Route path="/history-detail" element={<HistoryDetail />} />
        <Route path="/scoring-guide" element={<ScoringGuide />} />
        <Route path="*" element={<Navigate to="/practice/listen_choose" replace />} />
      </Routes>
      {!hideTabBar && <TabBar />}
    </div>
  );
}

export default function App() {
  return <AppLayout />;
}
