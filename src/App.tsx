import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Home } from './pages/Home'
import { Capture } from './pages/Capture'
import { WordSets } from './pages/WordSets'
import { WordReview } from './pages/WordReview'
import { Quiz } from './pages/Quiz'
import { ParentDashboard } from './pages/ParentDashboard'
import { ParentSessionDetail } from './pages/ParentSessionDetail'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/capture" element={<Capture />} />
        <Route path="/wordsets" element={<WordSets />} />
        <Route path="/wordsets/review" element={<WordReview />} />
        <Route path="/wordsets/:id" element={<WordReview />} />
        <Route path="/quiz/:wordSetId" element={<Quiz />} />
        <Route path="/parent" element={<ParentDashboard />} />
        <Route path="/parent/session/:groupId" element={<ParentSessionDetail />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
