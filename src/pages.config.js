/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AccessManagement from './pages/AccessManagement';
import BDAddLead from './pages/BDAddLead';
import BDCRM from './pages/BDCRM';
import BDClients from './pages/BDClients';
import BDMyPerformance from './pages/BDMyPerformance';
import BDPerformance from './pages/BDPerformance';
import BDPipeline from './pages/BDPipeline';
import BDSettings from './pages/BDSettings';
import BookingProfile from './pages/BookingProfile';
import Bookings from './pages/Bookings';
import CRM from './pages/CRM';
import CRMGuide from './pages/CRMGuide';
import ClientProfile from './pages/ClientProfile';
import Clients from './pages/Clients';
import Goals from './pages/Goals';
import HotelPerformance from './pages/HotelPerformance';
import LeaseRenewals from './pages/LeaseRenewals';
import MyPerformance from './pages/MyPerformance';
import ProductionCalendar from './pages/ProductionCalendar';
import PropertyAnalytics from './pages/PropertyAnalytics';
import RFPs from './pages/RFPs';
import RentalsReports from './pages/RentalsReports';
import Reports from './pages/Reports';
import ServicePricing from './pages/ServicePricing';
import Settings from './pages/Settings';
import Tasks from './pages/Tasks';
import Units from './pages/Units';
import UserManagement from './pages/UserManagement';
import WeeklyProductionReport from './pages/WeeklyProductionReport';
import SalesActivities from './pages/SalesActivities';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AccessManagement": AccessManagement,
    "BDAddLead": BDAddLead,
    "BDCRM": BDCRM,
    "BDClients": BDClients,
    "BDMyPerformance": BDMyPerformance,
    "BDPerformance": BDPerformance,
    "BDPipeline": BDPipeline,
    "BDSettings": BDSettings,
    "BookingProfile": BookingProfile,
    "Bookings": Bookings,
    "CRM": CRM,
    "CRMGuide": CRMGuide,
    "ClientProfile": ClientProfile,
    "Clients": Clients,
    "Goals": Goals,
    "HotelPerformance": HotelPerformance,
    "LeaseRenewals": LeaseRenewals,
    "MyPerformance": MyPerformance,
    "ProductionCalendar": ProductionCalendar,
    "PropertyAnalytics": PropertyAnalytics,
    "RFPs": RFPs,
    "RentalsReports": RentalsReports,
    "Reports": Reports,
    "ServicePricing": ServicePricing,
    "Settings": Settings,
    "Tasks": Tasks,
    "Units": Units,
    "UserManagement": UserManagement,
    "WeeklyProductionReport": WeeklyProductionReport,
    "SalesActivities": SalesActivities,
}

export const pagesConfig = {
    mainPage: "AccessManagement",
    Pages: PAGES,
    Layout: __Layout,
};