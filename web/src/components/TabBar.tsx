import { NavLink, useLocation } from 'react-router-dom';
import { Headphones, MessageCircle, Repeat, BookOpen, FilePen, Clock } from 'lucide-react';

const TABS = [
  { path: '/practice/listen_choose', label: '听后选择', icon: Headphones },
  { path: '/practice/listen_answer', label: '听后回答', icon: MessageCircle },
  { path: '/practice/listen_retell', label: '听后转述', icon: Repeat },
  { path: '/practice/read_aloud', label: '短文朗读', icon: BookOpen },
  { path: '/exam', label: '考试模拟', icon: FilePen },
  { path: '/history', label: '历史', icon: Clock },
];

export function TabBar() {
  const location = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl"
      style={{
        boxShadow: '0 -2px 12px rgba(79,70,229,0.06)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div
        className="mx-auto flex items-center justify-around"
        style={{ maxWidth: 480, height: 56 }}
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = location.pathname.startsWith(tab.path);

          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              className="flex flex-col items-center justify-center"
              style={{
                flex: 1,
                paddingTop: 6,
                paddingBottom: 6,
                gap: 2,
                textDecoration: 'none',
              }}
            >
              <Icon
                size={20}
                strokeWidth={isActive ? 2.5 : 2}
                color={isActive ? '#4F46E5' : '#A8A29E'}
              />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: isActive ? '#4F46E5' : '#A8A29E',
                }}
              >
                {tab.label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
