'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type Lang = 'en' | 'ar';
interface LangContextType {
  lang: Lang;
  toggleLang: () => void;
  t: (key: string) => string;
  dir: 'ltr' | 'rtl';
}

const translations: Record<string, Record<string, string>> = {
  en: {
    dashboard: 'Dashboard',
    clients: 'Clients',
    tasks: 'Tasks',
    assets: 'Assets',
    reports: 'Reports',
    team: 'Team',
    settings: 'Settings',
    notifications: 'Notifications',
    logout: 'Log out',
    search: 'Search...',
    welcomeBack: 'Welcome back',
    totalClients: 'Total Clients',
    activeTasks: 'Active Tasks',
    pendingApprovals: 'Pending Approvals',
    overdueTasks: 'Overdue Tasks',
    recentActivity: 'Recent Activity',
    newClient: 'New Client',
    companyName: 'Company Name',
    email: 'Email',
    phone: 'Phone',
    website: 'Website',
    industry: 'Industry',
    status: 'Status',
    notes: 'Notes',
    cancel: 'Cancel',
    save: 'Save',
    active: 'Active',
    inactive: 'Inactive',
    prospect: 'Prospect',
    overview: 'Overview',
    content: 'Content',
    approvals: 'Approvals',
    activity: 'Activity',
    newTask: 'New Task',
    title: 'Title',
    description: 'Description',
    priority: 'Priority',
    dueDate: 'Due Date',
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    todo: 'To Do',
    inProgress: 'In Progress',
    done: 'Done',
    overdue: 'Overdue',
    uploadFile: 'Upload File',
    noClientsYet: 'No clients yet',
    noClientsDesc: 'Add your first client to get started',
    noTasksYet: 'No tasks yet',
    noTasksDesc: 'Create your first task to get started',
    noAssetsYet: 'No assets yet',
    noAssetsDesc: 'Upload your first file to get started',
    loading: 'Loading...',
    loginTitle: 'Sign in to OPENY OS',
    registerTitle: 'Create your account',
    password: 'Password',
    name: 'Full Name',
    signIn: 'Sign In',
    signUp: 'Sign Up',
    noAccount: "Don't have an account?",
    hasAccount: 'Already have an account?',
    contentDistribution: 'Content Distribution',
    inprogress: 'In Progress',
    assignedTo: 'Assigned To',
    createdBy: 'Created By',
    mentions: 'Mentions',
    tags: 'Tags (comma separated)',
    taskDetails: 'Task Details',
    editTask: 'Edit Task',
    deleteTask: 'Delete Task',
    confirmDeleteTask: 'Are you sure you want to delete this task? This cannot be undone.',
    changeStatus: 'Change Status',
    reassign: 'Reassign',
    filterByClient: 'Filter by Client',
    filterByAssigned: 'Filter by Assigned',
    filterByPriority: 'Filter by Priority',
    allClients: 'All Clients',
    allMembers: 'All Members',
    allPriorities: 'All Priorities',
    noTeamMembers: 'No team members yet',
    noTeamMembersDesc: 'Add team members to assign tasks',
    newMember: 'New Member',
    fullName: 'Full Name',
    role: 'Role',
    activityHistory: 'Activity History',
    taskCreated: 'Task created',
    taskUpdated: 'Task updated',
    taskDeleted: 'Task deleted',
    upcomingDeadline: 'Due soon',
    selectTeamMember: 'Select team member',
    none: 'None',
    unassigned: 'Unassigned',
    deadline: 'Deadline',
    createdOn: 'Created',
    calendar: 'Calendar',
    myTasks: 'My Tasks',
    review: 'In Review',
    delivered: 'Delivered',
    startDate: 'Start Date',
    tasksDueToday: 'Due Today',
    tasksOverdue: 'Overdue',
    tasksInProgress: 'In Progress',
    tasksInReview: 'In Review',
    tasksCompleted: 'Completed',
    kanban: 'Kanban',
    list: 'List',
    tasksDueThisWeek: 'Due This Week',
    searchTasks: 'Search tasks...',
  },
  ar: {
    dashboard: 'لوحة التحكم',
    clients: 'العملاء',
    tasks: 'المهام',
    assets: 'الملفات',
    reports: 'التقارير',
    team: 'الفريق',
    settings: 'الإعدادات',
    notifications: 'الإشعارات',
    logout: 'تسجيل الخروج',
    search: 'بحث...',
    welcomeBack: 'مرحباً بعودتك',
    totalClients: 'إجمالي العملاء',
    activeTasks: 'المهام النشطة',
    pendingApprovals: 'الموافقات المعلقة',
    overdueTasks: 'المهام المتأخرة',
    recentActivity: 'النشاط الأخير',
    newClient: 'عميل جديد',
    companyName: 'اسم الشركة',
    email: 'البريد الإلكتروني',
    phone: 'الهاتف',
    website: 'الموقع الإلكتروني',
    industry: 'الصناعة',
    status: 'الحالة',
    notes: 'ملاحظات',
    cancel: 'إلغاء',
    save: 'حفظ',
    active: 'نشط',
    inactive: 'غير نشط',
    prospect: 'محتمل',
    overview: 'نظرة عامة',
    content: 'المحتوى',
    approvals: 'الموافقات',
    activity: 'النشاط',
    newTask: 'مهمة جديدة',
    title: 'العنوان',
    description: 'الوصف',
    priority: 'الأولوية',
    dueDate: 'تاريخ الاستحقاق',
    low: 'منخفضة',
    medium: 'متوسطة',
    high: 'عالية',
    todo: 'للتنفيذ',
    inProgress: 'قيد التنفيذ',
    done: 'مكتمل',
    overdue: 'متأخر',
    uploadFile: 'رفع ملف',
    noClientsYet: 'لا يوجد عملاء بعد',
    noClientsDesc: 'أضف عميلك الأول للبدء',
    noTasksYet: 'لا توجد مهام بعد',
    noTasksDesc: 'أنشئ مهمتك الأولى للبدء',
    noAssetsYet: 'لا توجد ملفات بعد',
    noAssetsDesc: 'ارفع ملفك الأول للبدء',
    loading: 'جار التحميل...',
    loginTitle: 'تسجيل الدخول إلى OPENY OS',
    registerTitle: 'إنشاء حساب جديد',
    password: 'كلمة المرور',
    name: 'الاسم الكامل',
    signIn: 'تسجيل الدخول',
    signUp: 'إنشاء حساب',
    noAccount: 'ليس لديك حساب؟',
    hasAccount: 'لديك حساب بالفعل؟',
    contentDistribution: 'توزيع المحتوى',
    inprogress: 'قيد التنفيذ',
    assignedTo: 'مسند إلى',
    createdBy: 'أنشئ بواسطة',
    mentions: 'الإشارات',
    tags: 'الوسوم (مفصولة بفاصلة)',
    taskDetails: 'تفاصيل المهمة',
    editTask: 'تعديل المهمة',
    deleteTask: 'حذف المهمة',
    confirmDeleteTask: 'هل أنت متأكد من حذف هذه المهمة؟ لا يمكن التراجع عن هذا الإجراء.',
    changeStatus: 'تغيير الحالة',
    reassign: 'إعادة إسناد',
    filterByClient: 'تصفية حسب العميل',
    filterByAssigned: 'تصفية حسب المسند إليه',
    filterByPriority: 'تصفية حسب الأولوية',
    allClients: 'جميع العملاء',
    allMembers: 'جميع الأعضاء',
    allPriorities: 'جميع الأولويات',
    noTeamMembers: 'لا يوجد أعضاء فريق بعد',
    noTeamMembersDesc: 'أضف أعضاء الفريق لإسناد المهام',
    newMember: 'عضو جديد',
    fullName: 'الاسم الكامل',
    role: 'الدور',
    activityHistory: 'سجل النشاط',
    taskCreated: 'تم إنشاء المهمة',
    taskUpdated: 'تم تحديث المهمة',
    taskDeleted: 'تم حذف المهمة',
    upcomingDeadline: 'موعد قريب',
    selectTeamMember: 'اختر عضو الفريق',
    none: 'لا يوجد',
    unassigned: 'غير مسند',
    deadline: 'الموعد النهائي',
    createdOn: 'تاريخ الإنشاء',
    calendar: 'التقويم',
    myTasks: 'مهامي',
    review: 'قيد المراجعة',
    delivered: 'تم التسليم',
    startDate: 'تاريخ البدء',
    tasksDueToday: 'مستحقة اليوم',
    tasksOverdue: 'متأخرة',
    tasksInProgress: 'قيد التنفيذ',
    tasksInReview: 'قيد المراجعة',
    tasksCompleted: 'مكتملة',
    kanban: 'كانبان',
    list: 'قائمة',
    tasksDueThisWeek: 'مستحقة هذا الأسبوع',
    searchTasks: 'بحث في المهام...',
  },
};

const LangContext = createContext<LangContextType | null>(null);

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>('en');

  useEffect(() => {
    const saved = localStorage.getItem('lang') as Lang | null;
    if (saved) {
      setLang(saved);
      document.documentElement.setAttribute('lang', saved);
      document.documentElement.setAttribute('dir', saved === 'ar' ? 'rtl' : 'ltr');
    }
  }, []);

  const toggleLang = () => {
    setLang(prev => {
      const next = prev === 'en' ? 'ar' : 'en';
      localStorage.setItem('lang', next);
      document.documentElement.setAttribute('lang', next);
      document.documentElement.setAttribute('dir', next === 'ar' ? 'rtl' : 'ltr');
      return next;
    });
  };

  const t = (key: string) => translations[lang]?.[key] ?? key;

  return (
    <LangContext.Provider value={{ lang, toggleLang, t, dir: lang === 'ar' ? 'rtl' : 'ltr' }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used inside LangProvider');
  return ctx;
}
