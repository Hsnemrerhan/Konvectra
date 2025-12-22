import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom' // <--- EKLENDİ
import App from './App.jsx'
import './index.css'
import 'react-image-crop/dist/ReactCrop.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  // StrictMode'u daha önce WebRTC için kaldırmıştık, böyle kalsın
  <BrowserRouter> 
    <App />
  </BrowserRouter>
)