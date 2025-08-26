import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Menu, LogOut, Camera, Bell, Flame, Loader2 } from 'lucide-react';
import type { Timestamp as FirebaseTimestamp } from 'firebase/compat/firestore';

import {
    auth, db, storage, appId,
    EmailAuthProvider, Timestamp, arrayUnion, onAuthStateChanged, signOut,
    reauthenticateWithCredential, deleteUser
} from './services/firebase';

import { translations, subjectDisplayTranslations, defaultHomeLayout } from './constants';
import type { AppUser, FileData, CalendarEvent, ModalContent, Notification, BroadcastData, ToDoTask, AdminSettings } from './types';

import CustomModal from './components/ui/Modal';
import BroadcastModal from './components/new/BroadcastModal';
import AuthView from './components/views/AuthView';
import HomeView from './components/views/HomeView';
import SubjectView from './components/views/SubjectView';
import CalendarView from './components/views/CalendarView';
import SettingsView from './components/views/SettingsView'; // Importeer de SettingsView
import InfoView from './components/views/InfoView';
import FaqView from './components/views/FaqView';
import ToolsView from './components/views/ToolsView';
import Sidebar from './components/ui/Sidebar';
import NotesView from './components/views/tools/NotesView';
import IntroTutorialView from './components/views/IntroTutorialView';
import AdminView from './components/views/AdminView';
import NotificationsView from './components/views/NotificationsView';
import EmailVerificationView from './components/views/EmailVerificationView';
import FeedbackView from './components/new/FeedbackView';
import UserDetailModal from './components/views/admin/UserDetailModal';
import AdminPinView from './components/views/admin/AdminPinView';
import PinVerificationModal from './components/views/admin/PinVerificationModal';
import OfflineIndicator from './components/ui/OfflineIndicator';


type AppStatus = 'initializing' | 'unauthenticated' | 'authenticated' | 'awaiting-verification';
type Unsubscribe = () => void;

// --- Loading Screen Component ---
const LoadingScreen: React.FC<{ getThemeClasses: (variant: string) => string }> = ({ getThemeClasses }) => (
    <div className={`fixed inset-0 flex flex-col items-center justify-center ${getThemeClasses('bg')} z-50`}>
       <img src="https://i.imgur.com/n5jikg9.png" alt="Schoolmaps Logo" className="h-auto mb-8" style={{ maxWidth: '180px' }} />
       <div role="status" aria-label="Loading application">
          <svg aria-hidden="true" className="w-10 h-10 text-white animate-spin" viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="rgba(255,255,255,0.3)"/>
            <path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0492C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="currentColor"/>
          </svg>
       </div>
    </div>
);


// --- Main App Layout for Authenticated Users (Now largely stateless) ---
const MainAppLayout: React.FC<{
    user: AppUser | null; // Aangepast naar AppUser | null, omdat App.tsx user als null kan hebben
    t: (key: string, replacements?: any) => string;
    tSubject: (key: string) => string;
    getThemeClasses: (variant: string) => string;
    showAppModal: (content: ModalContent) => void;
    closeAppModal: () => void;
    copyTextToClipboard: (text: string, title?: string) => boolean;
    setIsProfilePicModalOpen: (isOpen: boolean) => void;
    handleLogout: () => void;
    // Navigation state and handlers
    currentView: string;
    setCurrentView: (view: string) => void;
    currentSubject: string | null;
    setCurrentSubject: (subject: string | null) => void;
    handleGoHome: () => void;
    // Data for views
    subjectFiles: FileData[];
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    userEvents: CalendarEvent[];
    recentFiles: FileData[];
    // Props for SettingsView
    language: 'nl' | 'en';
    setLanguage: (lang: 'nl' | 'en') => void;
    themeColor: string;
    setThemeColor: (color: string) => void;
    fontFamily: string;
    setFontFamily: (font: string) => void;
    onProfileUpdate: (updatedData: Partial<AppUser>) => Promise<void>;
    onDeleteAccountRequest: () => void;
    onCleanupAccountRequest: () => void;
    // Notifications
    notifications: Notification[];
    unreadCount: number;
    showBroadcast: (broadcastId: string) => void;
    // Persistent Timer Props
    focusMinutes: number;
    setFocusMinutes: (m: number) => void;
    breakMinutes: number;
    setBreakMinutes: (m: number) => void;
    timerMode: 'focus' | 'break';
    setTimerMode: (m: 'focus' | 'break') => void;
    timeLeft: number;
    setTimeLeft: (s: number) => void;
    isTimerActive: boolean;
    setIsTimerActive: (a: boolean) => void;
    selectedTaskForTimer: ToDoTask | null;
    setSelectedTaskForTimer: (t: ToDoTask | null) => void;
}> = ({
    user, t, tSubject, getThemeClasses, showAppModal, copyTextToClipboard, setIsProfilePicModalOpen,
    handleLogout, currentView, setCurrentView, currentSubject, setCurrentSubject, handleGoHome,
    subjectFiles, searchQuery, setSearchQuery, userEvents, recentFiles,
    language, setLanguage, themeColor, setThemeColor, fontFamily, setFontFamily, onProfileUpdate, onDeleteAccountRequest, onCleanupAccountRequest, closeAppModal, notifications, unreadCount, showBroadcast,
    focusMinutes, setFocusMinutes, breakMinutes, setBreakMinutes, timerMode, setTimerMode, timeLeft, setTimeLeft, isTimerActive, setIsTimerActive, selectedTaskForTimer, setSelectedTaskForTimer
}) => {

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const sidebarRef = useRef<HTMLDivElement>(null);

    // Sidebar Click-outside Handler remains here as it's UI-specific to the layout
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node) && isSidebarOpen) {
                   const hamburgerButton = document.getElementById('hamburger-menu');
                   if(hamburgerButton && !hamburgerButton.contains(event.target as Node)) {
                     setIsSidebarOpen(false);
                   }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isSidebarOpen]);

    const toolsViewProps = { t, getThemeClasses, showAppModal, closeAppModal, userId: user?.uid, user, tSubject, copyTextToClipboard, focusMinutes, setFocusMinutes, breakMinutes, setBreakMinutes, timerMode, setTimerMode, timeLeft, setTimeLeft, isTimerActive, setIsTimerActive, selectedTaskForTimer, setSelectedTaskForTimer };

    const mainContent = (
        <div className="animate-fade-in">
            {currentView === 'home' && !currentSubject && <HomeView {...{ user, setCurrentView, t, getThemeClasses, tSubject, setCurrentSubject, recentFiles, userEvents, language }} />}
            {currentView === 'home' && currentSubject && <SubjectView {...{ user, currentSubject, subjectFiles, setCurrentSubject, t, tSubject, getThemeClasses, showAppModal, userId: user?.uid, searchQuery, setSearchQuery, copyTextToClipboard }} />}
            {currentView === 'calendar' && <CalendarView {...{ userEvents, t, getThemeClasses, tSubject, language, showAppModal, userId: user?.uid, user }} />}
            {currentView === 'notes' && <NotesView {...{ userId: user?.uid, user, t, tSubject, getThemeClasses, showAppModal }} />}
            {currentView === 'tools' && <ToolsView {...toolsViewProps} />}
            {/* Hier geven we de 'user' prop door aan SettingsView */}
            {currentView === 'settings' && <SettingsView {...{ user, t, getThemeClasses, language, setLanguage, themeColor, setThemeColor, showAppModal, tSubject, setCurrentView, onProfileUpdate, fontFamily, setFontFamily, onDeleteAccountRequest, onCleanupAccountRequest }} />}
            {currentView === 'notifications' && <NotificationsView {...{ user, t, getThemeClasses, notifications, setCurrentView, onProfileUpdate, showBroadcast, showAppModal }} />}
            {currentView === 'feedback' && <FeedbackView {...{ user, t, getThemeClasses, setCurrentView }} />}
            {currentView === 'appInfo' && <InfoView {...{ t, getThemeClasses, setCurrentView }} />}
            {currentView === 'faq' && <FaqView {...{ t, getThemeClasses, setCurrentView }} />}
        </div>
    );

    return (
        <div className={`flex h-screen w-full`}>
             <Sidebar {...{ user, isSidebarOpen, setIsSidebarOpen, sidebarRef, t, getThemeClasses, setCurrentView, currentView, currentSubject, setIsProfilePicModalOpen }} />
            <main className="flex-1 flex flex-col overflow-y-auto bg-slate-50">
               <header className="p-4 sticky top-0 bg-white/80 backdrop-blur-lg z-30 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                        <button type="button" id="hamburger-menu" onClick={() => setIsSidebarOpen(true)} className={`p-2 rounded-lg text-white ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')} transition-transform duration-200 active:scale-90`}>
                            <Menu className="w-6 h-6" />
                        </button>
                         <h1 onClick={handleGoHome} className={`text-2xl font-bold ${getThemeClasses('text-logo')} cursor-pointer transition-transform hover:scale-105 active:scale-100`}>
                            Schoolmaps
                          </h1>
                        <div className="flex items-center gap-2">
                           {isTimerActive && (
                                <button type="button" onClick={() => setCurrentView('tools')} className={`p-2 rounded-lg font-mono text-sm font-bold ${getThemeClasses('text')} bg-gray-100 hover:bg-gray-200`}>
                                    {Math.floor(timeLeft / 60).toString().padStart(2, '0')}:{(timeLeft % 60).toString().padStart(2, '0')}
                                </button>
                           )}
                           <button type="button" onClick={() => setCurrentView('notifications')} title={t('notifications_title')} className="relative p-2 rounded-lg text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors duration-200 active:scale-90">
                                <Bell className="w-6 h-6" />
                                {unreadCount > 0 && (
                                    <span className={`absolute top-0 right-0 flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-white ${getThemeClasses('bg')} transform translate-x-1/4 -translate-y-1/4`}>
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </span>
                                )}
                           </button>
                           <button type="button" onClick={handleLogout} title={t('logout_button')} className="p-2 rounded-lg text-red-500 bg-red-100 hover:bg-red-200 transition-colors duration-200 active:scale-90">
                                <LogOut className="w-6 h-6" />
                           </button>
                        </div>
                    </div>
               </header>
                <div className="flex-1 p-4 sm:p-6 lg:p-8">
                    <div className="max-w-7xl mx-auto">
                        {mainContent}
                    </div>
                </div>
            </main>
        </div>
    );
};

// --- Profile Picture Upload Modal ---
const ProfilePicModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    t: (key: string) => string;
    getThemeClasses: (variant: string) => string;
    handleProfilePicUpload: (file: File) => void;
}> = ({ isOpen, onClose, t, getThemeClasses, handleProfilePicUpload }) => {
    const [profilePicFile, setProfilePicFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            setProfilePicFile(null);
            setPreview(null);
            setIsUploading(false);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!profilePicFile) {
            setPreview(null);
            return;
        }
        const objectUrl = URL.createObjectURL(profilePicFile);
        setPreview(objectUrl);
        return () => URL.revokeObjectURL(objectUrl);
    }, [profilePicFile]);

    if (!isOpen) return null;

    const onUpload = async () => {
        if (profilePicFile) {
            setIsUploading(true);
            await handleProfilePicUpload(profilePicFile);
            setIsUploading(false);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 animate-fade-in" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full transform transition-all duration-300 scale-100 animate-scale-up" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold mb-4">{t('profile_picture_upload_label')}</h3>
                {preview && <img src={preview} alt="Preview" className="w-32 h-32 rounded-full mx-auto mb-4 object-cover" />}
                <input type="file" accept="image/*" onChange={e => setProfilePicFile(e.target.files ? e.target.files[0] : null)} className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100" />
                <div className="flex justify-end gap-2 mt-4">
                    <button onClick={onClose} className="py-2 px-4 rounded-lg bg-gray-200 hover:bg-gray-300 font-semibold transition-colors active:scale-95">{t('cancel_button')}</button>
                    <button onClick={onUpload} disabled={!profilePicFile || isUploading} className={`py-2 px-4 rounded-lg text-white font-bold ${getThemeClasses('bg')} ${getThemeClasses('hover-bg')} disabled:opacity-50 transition-colors active:scale-95 w-48 flex justify-center items-center`}>
                       {isUploading ? <Loader2 className="w-5 h-5 animate-spin"/> : t('upload_profile_picture_button')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const ReauthModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    t: (key: string) => string;
    getThemeClasses: (variant: string) => string;
    title?: string;
    description?: string;
    confirmButtonText?: string;
    confirmButtonColor?: string;
}> = ({ isOpen, onClose, onSuccess, t, getThemeClasses, title, description, confirmButtonText, confirmButtonColor = 'bg-red-600 hover:bg-red-700' }) => {
    const [password, setPassword] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleConfirm = async (e: React.FormEvent) => {
        e.preventDefault();
        const currentUser = auth.currentUser;
        if (!currentUser?.email) return;

        setIsVerifying(true);
        setError(null);

        try {
            const credential = EmailAuthProvider.credential(currentUser.email, password);
            await reauthenticateWithCredential(currentUser, credential);
            onSuccess();
            onClose();
        } catch (error) {
            setError(t('error_reauth_failed'));
        } finally {
            setIsVerifying(false);
        }
    };

    useEffect(() => {
        if (!isOpen) {
            setPassword('');
            setError(null);
            setIsVerifying(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
           <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 animate-fade-in" onClick={onClose}>
             <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full transform transition-all duration-300 scale-100 animate-scale-up" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold mb-2 text-gray-800">{title || t('reauth_modal_title')}</h3>
                <p className="text-gray-600 mb-4">{description || t('reauth_modal_description')}</p>
                <form onSubmit={handleConfirm}>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={t('password')}
                        className={`w-full p-2 border rounded-lg ${error ? 'border-red-500' : 'border-gray-300'}`}
                        required
                    />
                    {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
                    <div className="flex justify-end gap-2 mt-4">
                        <button type="button" onClick={onClose} className="py-2 px-4 rounded-lg bg-gray-200 hover:bg-gray-300 font-semibold transition-colors active:scale-95">{t('cancel_button')}</button>
                        <button type="submit" disabled={isVerifying} className={`py-2 px-4 rounded-lg text-white font-bold ${confirmButtonColor} disabled:opacity-50 transition-colors active:scale-95 w-52 flex items-center justify-center`}>
                             {isVerifying ? <Loader2 className="w-5 h-5 animate-spin"/> : (confirmButtonText || t('confirm_delete_account_button'))}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};


const App: React.FC = () => {
    // Top-level app state
    const [user, setUser] = useState<AppUser | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [appStatus, setAppStatus] = useState<AppStatus>('initializing');
    const [modalContent, setModalContent] = useState<ModalContent | null>(null);
    const [themeColor, setThemeColor] = useState(localStorage.getItem('themeColor') || 'emerald');
    const [language, setLanguage] = useState<'nl' | 'en'>((localStorage.getItem('appLanguage') as 'nl' | 'en') || 'nl');
    const [fontFamily, setFontFamily] = useState(localStorage.getItem('fontFamily') || 'inter');
    const [isProfilePicModalOpen, setIsProfilePicModalOpen] = useState(false);
    const [isReauthModalOpen, setIsReauthModalOpen] = useState(false);
    const [isCleanupReauthModalOpen, setIsCleanupReauthModalOpen] = useState(false);
    const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
    const [selectedBroadcast, setSelectedBroadcast] = useState<BroadcastData | null>(null);
    const [showIntro, setShowIntro] = useState(false);
    const [introChecked, setIntroChecked] = useState(false);
    const [isUserDetailModalOpen, setIsUserDetailModalOpen] = useState(false);
    const [selectedUserForDetail, setSelectedUserForDetail] = useState<AppUser | null>(null);
    const [isPinVerificationModalOpen, setIsPinVerificationModalOpen] = useState(false);
    const [verificationSkipped, setVerificationSkipped] = useState(sessionStorage.getItem('schoolmaps_verification_skipped') === 'true');

    // Admin specific state
    const [adminSettings, setAdminSettings] = useState<AdminSettings | null>(null);
    const [isPinVerified, setIsPinVerified] = useState(false);

    // Lifted state from MainAppLayout
    const [currentView, setCurrentView] = useState('home');
    const [currentSubject, setCurrentSubject] = useState<string | null>(null);
    const [allSubjectFiles, setAllSubjectFiles] = useState<FileData[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [userEvents, setUserEvents] = useState<CalendarEvent[]>([]);
    const [recentFiles, setRecentFiles] = useState<FileData[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

    // Persistent Study Timer State
    const [focusMinutes, setFocusMinutes] = useState(25);
    const [breakMinutes, setBreakMinutes] = useState(5);
    const [timerMode, setTimerMode] = useState<'focus' | 'break'>('focus');
    const [timeLeft, setTimeLeft] = useState(25 * 60);
    const [isTimerActive, setIsTimerActive] = useState(false);
    const [selectedTaskForTimer, setSelectedTaskForTimer] = useState<ToDoTask | null>(null);
    const timerAudioRef = useRef<HTMLAudioElement | null>(null);

    // Initial Loading states
    const [isAppReadyForDisplay, setIsAppReadyForDisplay] = useState(false);
    const [isMinLoadingTimePassed, setIsMinLoadingTimePassed] = useState(false);
    const [isOnline, setIsOnline] = useState(navigator.onLine);


    // Memoized theme and translation functions
    const themeStyles: { [color: string]: { [variant: string]: string } } = {
        emerald: { bg: 'bg-emerald-500', 'hover-bg': 'hover:bg-emerald-600', text: 'text-emerald-700', 'text-strong': 'text-emerald-800', border: 'border-emerald-500', ring: 'focus:ring-emerald-500', 'bg-light': 'bg-emerald-50', 'border-light': 'border-emerald-100', 'text-logo': 'text-emerald-600' },
        blue: { bg: 'bg-blue-500', 'hover-bg': 'hover:bg-blue-600', text: 'text-blue-700', 'text-strong': 'text-blue-800', border: 'border-blue-500', ring: 'focus:ring-blue-500', 'bg-light': 'bg-blue-50', 'border-light': 'border-blue-100', 'text-logo': 'text-blue-600' },
        rose: { bg: 'bg-rose-500', 'hover-bg': 'hover:bg-rose-600', text: 'text-rose-700', 'text-strong': 'text-rose-800', border: 'border-rose-500', ring: 'focus:ring-rose-500', 'bg-light': 'bg-rose-50', 'border-light': 'border-rose-100', 'text-logo': 'text-rose-600' },
        purple: { bg: 'bg-purple-500', 'hover-bg': 'hover:bg-purple-600', text: 'text-purple-700', 'text-strong': 'text-purple-800', border: 'border-purple-500', ring: 'focus:ring-purple-500', 'bg-light': 'bg-purple-50', 'border-light': 'border-purple-100', 'text-logo': 'text-purple-600' },
        pink: { bg: 'bg-pink-500', 'hover-bg': 'hover:bg-pink-600', text: 'text-pink-700', 'text-strong': 'text-pink-800', border: 'border-pink-500', ring: 'focus:ring-pink-500', 'bg-light': 'bg-pink-50', 'border-light': 'border-pink-100', 'text-logo': 'text-pink-600' },
        indigo: { bg: 'bg-indigo-500', 'hover-bg': 'hover:bg-indigo-600', text: 'text-indigo-700', 'text-strong': 'text-indigo-800', border: 'border-indigo-500', ring: 'focus:ring-indigo-500', 'bg-light': 'bg-indigo-50', 'border-light': 'border-indigo-100', 'text-logo': 'text-indigo-600' },
        teal: { bg: 'bg-teal-500', 'hover-bg': 'hover:bg-teal-600', text: 'text-teal-700', 'text-strong': 'text-teal-800', border: 'border-teal-500', ring: 'focus:ring-teal-500', 'bg-light': 'bg-teal-50', 'border-light': 'border-teal-100', 'text-logo': 'text-teal-600' },
        amber: { bg: 'bg-amber-500', 'hover-bg': 'hover:bg-amber-600', text: 'text-amber-700', 'text-strong': 'text-amber-800', border: 'border-amber-500', ring: 'focus:ring-amber-500', 'bg-light': 'bg-amber-50', 'border-light': 'border-amber-100', 'text-logo': 'text-amber-600' }
    };

    const fontClasses: { [key: string]: string } = {
        inter: 'font-inter',
        poppins: 'font-poppins',
        lato: 'font-lato',
        'roboto-slab': 'font-roboto-slab',
        lora: 'font-lora',
    };

    const getThemeClasses = useCallback((variant: string): string => {
        const currentTheme = isAdmin ? adminSettings?.themePreference : themeColor;
        return (themeStyles[currentTheme || 'emerald']?.[variant]) || themeStyles['emerald'][variant] || '';
    }, [themeColor, isAdmin, adminSettings]);

    const getAuthThemeClasses = useCallback((variant: string): string => {
        // Auth view should always be the default green theme
        return (themeStyles['emerald']?.[variant]) || '';
    }, []);

    const t = useCallback((key: string, replacements: { [key: string]: string | number } = {}): string => {
        let text = translations[language]?.[key] || translations['nl']?.[key] || key;
        for (const placeholder in replacements) {
            text = text.replace(`{${placeholder}}`, String(replacements[placeholder]));
        }
        return text;
    }, [language]);

    const tSubject = useCallback((subjectKey: string): string => {
        const lang = language as keyof typeof subjectDisplayTranslations;
        if (!subjectKey) return ''; // Guard against null/undefined keys
        return subjectDisplayTranslations[lang]?.[subjectKey] || subjectDisplayTranslations['nl']?.[subjectKey] || subjectKey.charAt(0).toUpperCase() + subjectKey.slice(1).replace(/_/g, ' ');
    }, [language]);

    const showAppModal = useCallback((content: ModalContent) => setModalContent(content), []);
    const closeAppModal = useCallback(() => setModalContent(null), []);

    const showBroadcastModal = useCallback(async (broadcastId: string) => {
        const broadcastDocRef = db.doc(`artifacts/${appId}/public/data/broadcasts/${broadcastId}`);
        const broadcastDoc = await broadcastDocRef.get();
        if (broadcastDoc.exists) {
            setSelectedBroadcast(broadcastDoc.data() as BroadcastData);
            setIsBroadcastModalOpen(true);
        }
    }, []);

    const handleUserDetailClick = (user: AppUser) => {
        setSelectedUserForDetail(user);
        setIsUserDetailModalOpen(true);
    };

    const handleIntroFinish = useCallback(() => {
        try {
            localStorage.setItem('schoolmaps_intro_seen', 'true');
        } catch (error) {
            console.error("Could not set localStorage item:", error);
        }
        setShowIntro(false);
    }, []);

    const handleSkipVerification = () => {
        sessionStorage.setItem('schoolmaps_verification_skipped', 'true');
        setVerificationSkipped(true);
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsMinLoadingTimePassed(true);
        }, 1500); // Reduced loading time
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (appStatus !== 'initializing' && introChecked) {
            setIsAppReadyForDisplay(true);
        }
    }, [appStatus, introChecked]);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            showAppModal({ text: t('app_back_online_message') });
        };
        const handleOffline = () => {
            setIsOnline(false);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [showAppModal, t]);

    useEffect(() => {
        timerAudioRef.current = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-clear-announce-tones-2861.mp3');
    }, []);

    const switchTimerMode = useCallback((completedMode: 'focus' | 'break') => {
        if (timerAudioRef.current) {
            timerAudioRef.current.play().catch(e => console.error("Error playing sound:", e));
        }

        showAppModal({ text: t(completedMode === 'focus' ? 'focus_session_complete' : 'break_session_complete')});

        const newMode = completedMode === 'focus' ? 'break' : 'focus';
        setTimerMode(newMode);
        setIsTimerActive(false);
    }, [showAppModal, t]);

    useEffect(() => {
        let interval: ReturnType<typeof setInterval> | null = null;
        if (isTimerActive && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft(time => time - 1);
            }, 1000);
        } else if (isTimerActive && timeLeft === 0) {
            switchTimerMode(timerMode);
        }
        return () => { if (interval) clearInterval(interval) };
    }, [isTimerActive, timeLeft, switchTimerMode, timerMode]);

    useEffect(() => {
        if (!isTimerActive) {
          setTimeLeft(timerMode === 'focus' ? focusMinutes * 60 : breakMinutes * 60);
        }
    }, [focusMinutes, breakMinutes, timerMode, isTimerActive]);


    const handleLogout = useCallback(() => {
        showAppModal({
            text: t('confirm_logout'),
            confirmAction: async () => {
                sessionStorage.setItem('logout-event', 'true');
                sessionStorage.removeItem('schoolmaps_verification_skipped');
                await signOut(auth);
                setIsAdmin(false);
                setIsPinVerified(false);
                setAdminSettings(null);
            },
            cancelAction: () => {}
        });
    }, [showAppModal, t]);

    const handleGoHome = useCallback(() => {
        setCurrentView('home');
        setCurrentSubject(null);
    }, []);

    // Data fetching effects, now at top level
    useEffect(() => {
        if (!user?.uid || user.uid === 'guest-user' || isAdmin) {
            setUserEvents([]);
            setRecentFiles([]);
            setNotifications([]);
            return;
        }

        const eventsQuery = db.collection(`artifacts/${appId}/users/${user.uid}/calendarEvents`).orderBy('start', 'asc');
        const unsubscribeEvents = eventsQuery.onSnapshot((snapshot) => {
            const fetchedEvents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CalendarEvent));
            setUserEvents(fetchedEvents);
        });

        const filesQuery = db.collection(`artifacts/${appId}/public/data/files`).where('ownerId', '==', user.uid).orderBy('createdAt', 'desc').limit(5);
        const unsubscribeFiles = filesQuery.onSnapshot((snapshot) => {
            const fetchedFiles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FileData));
            setRecentFiles(fetchedFiles);
        });

        const notifsQuery = db.collection(`artifacts/${appId}/users/${user.uid}/notifications`).orderBy('createdAt', 'desc').limit(50);
        const unsubscribeNotifs = notifsQuery.onSnapshot(snapshot => {
            const fetchedNotifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
            setNotifications(fetchedNotifs);
        });

        // Listen for new broadcasts
        const broadcastQuery = db.collection(`artifacts/${appId}/public/data/broadcasts`).orderBy('createdAt', 'desc').limit(10);
        const unsubscribeBroadcasts = broadcastQuery.onSnapshot(async (broadcastSnapshot) => {
            if (broadcastSnapshot.empty || !user?.uid || isAdmin) return;

            const userNotifsRef = db.collection(`artifacts/${appId}/users/${user.uid}/notifications`);
            const existingBroadcastNotifsQuery = userNotifsRef.where('broadcastId', '!=', null);
            const existingBroadcastNotifsSnapshot = await existingBroadcastNotifsQuery.get();
            const existingBroadcastIds = new Set(existingBroadcastNotifsSnapshot.docs.map(doc => doc.data().broadcastId));

            const batch = db.batch();
            let hasNewBroadcasts = false;

            broadcastSnapshot.docChanges().forEach((change) => {
              if (change.type === 'added' && !existingBroadcastIds.has(change.doc.id)) {
                  const newBroadcast = change.doc.data() as BroadcastData;
                  const newNotification: Notification = {
                      id: `${change.doc.id}-${Date.now()}`,
                      type: 'broadcast',
                      title: newBroadcast.title,
                      message: newBroadcast.message,
                      createdAt: Timestamp.now() as unknown as FirebaseTimestamp, // Casting to FirebaseTimestamp
                      read: false,
                      broadcastId: change.doc.id,
                      link: `/notifications?broadcastId=${change.doc.id}`
                  };
                  batch.set(userNotifsRef.doc(newNotification.id), newNotification);
                  hasNewBroadcasts = true;
              }
            });

            if (hasNewBroadcasts) {
                try {
                    await batch.commit();
                } catch (error) {
                    console.error("Error committing new broadcast notifications:", error);
                }
            }
        });

        return () => {
            unsubscribeEvents();
            unsubscribeFiles();
            unsubscribeNotifs();
            unsubscribeBroadcasts();
        };
    }, [user, isAdmin, appId]); // Dependencies for data fetching

    // Authentication and App status management
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                // Fetch AppUser data from Firestore
                const userDocRef = db.doc(`artifacts/${appId}/users/${firebaseUser.uid}`);
                const userDoc = await userDocRef.get();
                if (userDoc.exists) {
                    const appUser = userDoc.data() as AppUser;
                    setUser({ ...appUser, uid: firebaseUser.uid });

                    // Check if intro has been seen
                    let introSeen = false;
                    try {
                        introSeen = localStorage.getItem('schoolmaps_intro_seen') === 'true';
                    } catch (error) {
                        console.error("Could not read localStorage item:", error);
                    }
                    if (!introSeen) {
                        setShowIntro(true);
                    }
                    setIntroChecked(true); // Mark intro check as complete

                    // Admin check
                    if (appUser.role === 'admin') {
                        setIsAdmin(true);
                        // Fetch admin settings
                        const adminSettingsDoc = await db.doc(`artifacts/${appId}/public/data/adminSettings`).get();
                        if (adminSettingsDoc.exists) {
                            setAdminSettings(adminSettingsDoc.data() as AdminSettings);
                        }
                    }

                    if (!firebaseUser.emailVerified && appUser.provider === 'password' && !verificationSkipped) {
                        setAppStatus('awaiting-verification');
                    } else {
                        setAppStatus('authenticated');
                    }
                } else {
                    // This case should ideally not happen if user creation flow is robust
                    // but as a fallback, set a basic user and log it.
                    setUser({ uid: firebaseUser.uid, email: firebaseUser.email || 'unknown', role: 'user' });
                    setAppStatus('authenticated');
                    console.warn('AppUser document not found for', firebaseUser.uid, 'using basic user data.');
                }
            } else {
                setUser(null);
                setAppStatus('unauthenticated');
                setIsAdmin(false);
                setIsPinVerified(false);
                setAdminSettings(null);
                setIntroChecked(true); // Ensure intro check is marked complete even if unauthenticated
            }
        });

        // Cleanup listener on component unmount
        return () => unsubscribe();
    }, [appId, verificationSkipped]);


    // Function to handle profile picture upload
    const handleProfilePicUpload = useCallback(async (file: File) => {
        if (!user?.uid) {
            showAppModal({ text: t('error_not_logged_in') });
            return;
        }

        const storageRef = storage.ref();
        const fileRef = storageRef.child(`users/${user.uid}/profilePictures/${file.name}`);

        try {
            await fileRef.put(file);
            const photoURL = await fileRef.getDownloadURL();

            await db.doc(`artifacts/${appId}/users/${user.uid}`).update({ photoURL });
            setUser(prevUser => (prevUser ? { ...prevUser, photoURL } : null));
            showAppModal({ text: t('profile_picture_updated') });
        } catch (error) {
            console.error("Error uploading profile picture:", error);
            showAppModal({ text: t('error_upload_failed') });
        }
    }, [user, showAppModal, t, appId]);

    // Function to update user profile (e.g., display name, language, theme)
    const onProfileUpdate = useCallback(async (updatedData: Partial<AppUser>) => {
        if (!user?.uid) return;
        try {
            await db.doc(`artifacts/${appId}/users/${user.uid}`).update(updatedData);
            setUser(prevUser => (prevUser ? { ...prevUser, ...updatedData } : null));
            showAppModal({ text: t('profile_updated_success') });

            if (updatedData.language) {
                setLanguage(updatedData.language as 'nl' | 'en');
                localStorage.setItem('appLanguage', updatedData.language);
            }
            if (updatedData.themeColor) {
                setThemeColor(updatedData.themeColor);
                localStorage.setItem('themeColor', updatedData.themeColor);
            }
            if (updatedData.fontFamily) {
                setFontFamily(updatedData.fontFamily);
                localStorage.setItem('fontFamily', updatedData.fontFamily);
            }
        } catch (error) {
            console.error("Error updating profile:", error);
            showAppModal({ text: t('error_profile_update_failed') });
        }
    }, [user, showAppModal, t, appId, setLanguage, setThemeColor, setFontFamily]);

    // Function to handle account deletion request
    const onDeleteAccountRequest = useCallback(() => {
        setIsReauthModalOpen(true);
    }, []);

    const handleDeleteAccount = useCallback(async () => {
        const currentUser = auth.currentUser;
        if (!currentUser) return;

        try {
            // Delete user data from Firestore
            const userDocRef = db.doc(`artifacts/${appId}/users/${currentUser.uid}`);
            await userDocRef.delete();

            // Delete user account from Firebase Auth
            await deleteUser(currentUser);
            showAppModal({ text: t('account_deleted_success') });
            handleLogout(); // Log out and reset app state
        } catch (error) {
            console.error("Error deleting account:", error);
            showAppModal({ text: t('error_account_delete_failed') });
        }
    }, [appId, handleLogout, showAppModal, t]);

    // Function to handle account cleanup request
    const onCleanupAccountRequest = useCallback(() => {
        setIsCleanupReauthModalOpen(true);
    }, []);

    const handleCleanupAccount = useCallback(async () => {
        const currentUser = auth.currentUser;
        if (!currentUser?.uid) return;

        showAppModal({
            text: t('confirm_cleanup_account'),
            confirmAction: async () => {
                try {
                    // Logic to delete specific user data, leaving the account intact
                    // Example: delete all files owned by the user
                    const filesToDeleteQuery = db.collection(`artifacts/${appId}/public/data/files`).where('ownerId', '==', currentUser.uid);
                    const filesSnapshot = await filesToDeleteQuery.get();
                    const batch = db.batch();
                    filesSnapshot.docs.forEach(doc => {
                        batch.delete(doc.ref);
                    });
                    await batch.commit();

                    // Example: clear calendar events
                    const eventsToDeleteQuery = db.collection(`artifacts/${appId}/users/${currentUser.uid}/calendarEvents`);
                    const eventsSnapshot = await eventsToDeleteQuery.get();
                    const eventsBatch = db.batch();
                    eventsSnapshot.docs.forEach(doc => {
                        eventsBatch.delete(doc.ref);
                    });
                    await eventsBatch.commit();


                    showAppModal({ text: t('account_cleanup_success') });
                } catch (error) {
                    console.error("Error cleaning up account:", error);
                    showAppModal({ text: t('error_account_cleanup_failed') });
                }
            },
            cancelAction: () => {}
        });
    }, [appId, showAppModal, t]);

    // Utility function for copying text to clipboard
    const copyTextToClipboard = useCallback((text: string, title?: string): boolean => {
        try {
            document.execCommand('copy');
            showAppModal({
                text: title ? t('copied_to_clipboard_with_title', { title }) : t('copied_to_clipboard'),
                type: 'info'
            });
            return true;
        } catch (err) {
            console.error('Failed to copy text: ', err);
            showAppModal({
                text: t('error_copy_to_clipboard'),
                type: 'error'
            });
            return false;
        }
    }, [showAppModal, t]);


    // Conditional rendering based on app status and loading
    if (!isAppReadyForDisplay || !isMinLoadingTimePassed) {
        return <LoadingScreen getThemeClasses={getThemeClasses} />;
    }

    // Render AuthView if unauthenticated
    if (appStatus === 'unauthenticated') {
        return (
            <div className={`h-screen flex items-center justify-center ${fontClasses[fontFamily]} ${getAuthThemeClasses('bg-light')}`}>
                <AuthView {...{ t, getThemeClasses: getAuthThemeClasses, showAppModal }} />
                <CustomModal content={modalContent} onClose={closeAppModal} getThemeClasses={getThemeClasses} t={t} />
            </div>
        );
    }

    // Render EmailVerificationView if authenticated but email not verified
    if (appStatus === 'awaiting-verification' && user) {
        return (
            <div className={`h-screen flex items-center justify-center ${fontClasses[fontFamily]} ${getThemeClasses('bg-light')}`}>
                <EmailVerificationView {...{ user, t, getThemeClasses, showAppModal, handleLogout, handleSkipVerification }} />
                <CustomModal content={modalContent} onClose={closeAppModal} getThemeClasses={getThemeClasses} t={t} />
            </div>
        );
    }

    // Render IntroTutorialView for new authenticated users
    if (showIntro && user) {
        return (
            <div className={`h-screen flex flex-col ${fontClasses[fontFamily]} ${getThemeClasses('bg-light')}`}>
                <IntroTutorialView {...{ user, t, getThemeClasses, handleIntroFinish }} />
                <CustomModal content={modalContent} onClose={closeAppModal} getThemeClasses={getThemeClasses} t={t} />
            </div>
        );
    }

    // Render AdminPinView if admin but not yet pin verified
    if (isAdmin && user && adminSettings?.adminPin && !isPinVerified) {
        return (
            <div className={`h-screen flex items-center justify-center ${fontClasses[fontFamily]} ${getThemeClasses('bg-light')}`}>
                <AdminPinView {...{ user, t, getThemeClasses, showAppModal, handleLogout, setIsPinVerified, adminSettings }} />
                <CustomModal content={modalContent} onClose={closeAppModal} getThemeClasses={getThemeClasses} t={t} />
            </div>
        );
    }

    // Render AdminView if admin and pin verified
    if (isAdmin && user && isPinVerified) {
        return (
            <div className={`${fontClasses[fontFamily]} ${getThemeClasses('bg-light')}`}>
                <AdminView {...{ user, t, getThemeClasses, showAppModal, handleLogout, setCurrentView, currentView, isAdmin, adminSettings, onProfileUpdate, handleUserDetailClick, showBroadcastModal }} />
                <CustomModal content={modalContent} onClose={closeAppModal} getThemeClasses={getThemeClasses} t={t} />
                <BroadcastModal isOpen={isBroadcastModalOpen} onClose={() => setIsBroadcastModalOpen(false)} t={t} getThemeClasses={getThemeClasses} selectedBroadcast={selectedBroadcast} user={user} />
                <UserDetailModal isOpen={isUserDetailModalOpen} onClose={() => setIsUserDetailModalOpen(false)} t={t} getThemeClasses={getThemeClasses} user={selectedUserForDetail} showAppModal={showAppModal} />
                <PinVerificationModal isOpen={isPinVerificationModalOpen} onClose={() => setIsPinVerificationModalOpen(false)} t={t} getThemeClasses={getThemeClasses} userId={user.uid} showAppModal={showAppModal} />
            </div>
        );
    }

    // Render MainAppLayout for authenticated users
    if (user) {
        return (
            <div className={`${fontClasses[fontFamily]} ${getThemeClasses('bg-light')}`}>
                <MainAppLayout {...{
                    user,
                    t,
                    tSubject,
                    getThemeClasses,
                    showAppModal,
                    closeAppModal,
                    copyTextToClipboard,
                    setIsProfilePicModalOpen,
                    handleLogout,
                    currentView,
                    setCurrentView,
                    currentSubject,
                    setCurrentSubject,
                    handleGoHome,
                    subjectFiles: allSubjectFiles, // allSubjectFiles wordt gefilterd in HomeView
                    searchQuery,
                    setSearchQuery,
                    userEvents,
                    recentFiles,
                    language,
                    setLanguage,
                    themeColor,
                    setThemeColor,
                    fontFamily,
                    setFontFamily,
                    onProfileUpdate,
                    onDeleteAccountRequest,
                    onCleanupAccountRequest,
                    notifications,
                    unreadCount,
                    showBroadcast: showBroadcastModal,
                    focusMinutes,
                    setFocusMinutes,
                    breakMinutes,
                    setBreakMinutes,
                    timerMode,
                    setTimerMode,
                    timeLeft,
                    setTimeLeft,
                    isTimerActive,
                    setIsTimerActive,
                    selectedTaskForTimer,
                    setSelectedTaskForTimer,
                }} />
                <CustomModal content={modalContent} onClose={closeAppModal} getThemeClasses={getThemeClasses} t={t} />
                <ProfilePicModal
                    isOpen={isProfilePicModalOpen}
                    onClose={() => setIsProfilePicModalOpen(false)}
                    t={t}
                    getThemeClasses={getThemeClasses}
                    handleProfilePicUpload={handleProfilePicUpload}
                />
                <ReauthModal
                    isOpen={isReauthModalOpen}
                    onClose={() => setIsReauthModalOpen(false)}
                    onSuccess={handleDeleteAccount}
                    t={t}
                    getThemeClasses={getThemeClasses}
                    title={t('confirm_delete_account_title')}
                    description={t('confirm_delete_account_description')}
                    confirmButtonText={t('delete_account_button')}
                />
                <ReauthModal
                    isOpen={isCleanupReauthModalOpen}
                    onClose={() => setIsCleanupReauthModalOpen(false)}
                    onSuccess={handleCleanupAccount}
                    t={t}
                    getThemeClasses={getThemeClasses}
                    title={t('confirm_cleanup_account_title')}
                    description={t('confirm_cleanup_account_description')}
                    confirmButtonText={t('cleanup_account_button')}
                    confirmButtonColor="bg-blue-600 hover:bg-blue-700"
                />
                <BroadcastModal isOpen={isBroadcastModalOpen} onClose={() => setIsBroadcastModalOpen(false)} t={t} getThemeClasses={getThemeClasses} selectedBroadcast={selectedBroadcast} user={user} />
                <OfflineIndicator isOnline={isOnline} t={t} getThemeClasses={getThemeClasses} />
            </div>
        );
    }

    return null; // Should not reach here if appStatus is handled correctly
};

export default App;
