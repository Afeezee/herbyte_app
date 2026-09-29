// Route table consumed by App.jsx. Keys become URL paths via
// `createPageUrl` in `src/utils/index.ts` (lower-case, spaces → hyphens).
// Add a new page by importing it here and adding it to PAGES.
import Home from './pages/Home';
import ExploreHerbs from './pages/ExploreHerbs';
import HerbProfile from './pages/HerbProfile';
import SubmitRemedy from './pages/SubmitRemedy';
import About from './pages/About';
import Contact from './pages/Contact';
import ExploreRemedies from './pages/ExploreRemedies';
import RemedyProfile from './pages/RemedyProfile';
import SellerDashboard from './pages/SellerDashboard';
import ExploreProducts from './pages/ExploreProducts';
import ProductProfile from './pages/ProductProfile';
import UserProfile from './pages/UserProfile';
import Wishlist from './pages/Wishlist';
import Events from './pages/Events';
import EventProfile from './pages/EventProfile';
import OrganizeEvent from './pages/OrganizeEvent';
import AdminDashboard from './pages/AdminDashboard';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Home": Home,
    "ExploreHerbs": ExploreHerbs,
    "HerbProfile": HerbProfile,
    "SubmitRemedy": SubmitRemedy,
    "About": About,
    "Contact": Contact,
    "ExploreRemedies": ExploreRemedies,
    "RemedyProfile": RemedyProfile,
    "SellerDashboard": SellerDashboard,
    "ExploreProducts": ExploreProducts,
    "ProductProfile": ProductProfile,
    "UserProfile": UserProfile,
    "Wishlist": Wishlist,
    "Events": Events,
    "EventProfile": EventProfile,
    "OrganizeEvent": OrganizeEvent,
    "AdminDashboard": AdminDashboard,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};