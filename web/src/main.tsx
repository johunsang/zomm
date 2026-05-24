import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Settings from './pages/Settings';
import Join from './pages/Join';
import Lecture from './pages/Lecture';
import './styles.css';
import { installImeGuard } from './lib/imeGuard';

// 전역 한글 IME 보정 (RtkMeeting 채팅 등 서드파티 입력 포함).
installImeGuard();

// StrictMode 미사용: 개발모드의 이중 렌더가 한글 IME 입력 시 마지막 글자를 중복시킴.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/join/:id" element={<Join />} />
      <Route path="/lecture/:id" element={<Lecture />} />
    </Routes>
  </BrowserRouter>,
);
