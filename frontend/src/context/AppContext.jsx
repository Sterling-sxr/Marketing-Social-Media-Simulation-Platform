import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getJson, patchJson, postJson } from "../lib/api";

const makeStatus = () => ({
  loading: false,
  message: "",
  error: "",
  devCode: "",
});
const makeSimpleStatus = () => ({ loading: false, message: "", error: "" });
export const createEmptyProfileData = () => ({
  gender: "",
  city: "",
  age_group: "",
  education_level: "",
  income_level: "",
  social_value: 5,
  interests: [],
  sociability: 5,
  openness: 5,
  shopping_frequency: "",
  buying_behavior: "",
  decision_factor: "",
  shopping_preference: "",
  digital_time: "",
  content_preference: "",
  interaction_style: "",
  influencer_type: "",
});
const createProfileData = createEmptyProfileData;

const AppContext = createContext(null);

const LAST_NOTIF_PREFIX = "bread:lastNotificationSeen:";

const PROFILE_ENDPOINT = "/api/profile";
const COURSE_ENDPOINT = "/api/courses";

const AUTH_ENDPOINTS = {
  registerStart: "/api/auth/send-code/",
  registerVerify: "/api/auth/verify-code/",
  registerComplete: "/api/auth/set-password/",
  login: "/api/auth/login/",
  logout: "/api/auth/logout/",
  resetStart: "/api/auth/reset/send-code/",
  resetVerify: "/api/auth/reset/verify-code/",
  resetComplete: "/api/auth/reset/complete/",
};

export function AppProvider({ children }) {
  const [authUser, setAuthUser] = useState(null);
  const [authCheckComplete, setAuthCheckComplete] = useState(false);

  // Section note: groups related logic for readability.
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerStatus, setRegisterStatus] = useState(makeStatus);
  const [verifyDigits, setVerifyDigits] = useState(["", "", "", ""]);
  const [verifyStatus, setVerifyStatus] = useState(makeStatus);
  const [verifyContext, setVerifyContext] = useState(null);
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerPasswordConfirm, setRegisterPasswordConfirm] = useState("");
  const [registerCompleteStatus, setRegisterCompleteStatus] =
    useState(makeSimpleStatus);
  const [registerVerifiedEmail, setRegisterVerifiedEmail] = useState("");

  // Section note: groups related logic for readability.
  const [resetEmail, setResetEmail] = useState("");
  const [resetStatus, setResetStatus] = useState(makeStatus);
  const [resetVerifiedEmail, setResetVerifiedEmail] = useState("");
  const [resetPasswords, setResetPasswords] = useState({
    password: "",
    confirm: "",
  });
  const [resetCompleteStatus, setResetCompleteStatus] =
    useState(makeSimpleStatus);

  // Section note: groups related logic for readability.
  const [profileOptions, setProfileOptions] = useState(null);
  const [profileData, setProfileData] = useState(createProfileData);
  const [profileStatus, setProfileStatus] = useState(makeSimpleStatus);

  // Section note: groups related logic for readability.
  const [courses, setCourses] = useState({ joined: [], available: [] });
  const [courseStatus, setCourseStatus] = useState(makeSimpleStatus);
  const [joinCode, setJoinCode] = useState("");
  const [notifications, setNotifications] = useState({ items: [], unread: 0 });
  const [notificationStatus, setNotificationStatus] =
    useState(makeSimpleStatus);
  const wsRef = useRef(null);
  const [toasts, setToasts] = useState([]);
  const seenNotificationIdsRef = useRef(new Set());
  const offlineSummaryShownRef = useRef(false);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback((toast) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const payload = { id, ...toast };
    setToasts((prev) => [payload, ...prev].slice(0, 5));

    // Section note: groups related logic for readability.
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);

    return id;
  }, []);

    const registerNotification = useCallback(
        (notification, { silent = false } = {}) => {
            if (!notification || notification.id == null) return;
            if (seenNotificationIdsRef.current.has(notification.id)) return;
            // Section note: groups related logic for readability.
            if (
              toasts.some(
                (t) =>
                  t.notification_id === notification.id ||
                  (t.title === (notification.subject || "") && t.message === (notification.body || notification.metadata?.reason || notification.action || ""))
              )
            ) {
              return;
            }
            seenNotificationIdsRef.current.add(notification.id);
            if (silent) return;

      const title = notification.subject || "New notification";
      const message =
        notification.body ||
        notification.metadata?.reason ||
        notification.action ||
        "You have a new notification.";
      pushToast({
        title,
        message,
        link: notification.link || "",
        notification_id: notification.id,
      });
    },
    [pushToast]
  );

  const isAuthenticated = useMemo(() => Boolean(authUser), [authUser]);


  // Section note: groups related logic for readability.
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const data = await getJson("/api/auth/status/");
        if (data.authenticated && data.user) {
          setAuthUser(data.user);
        }
      } catch (error) {
        // Section note: groups related logic for readability.
      } finally {
        setAuthCheckComplete(true);
      }
    };
    checkAuth();
  }, []);

  // Section note: groups related logic for readability.
  useEffect(() => {
    const userId = authUser?.id;
    if (!userId) return;
    let cancelled = false;

    const syncProfile = async () => {
      try {
        const data = await getJson(`/api/users/${userId}/profile/`);
        if (cancelled) return;
        setAuthUser((prev) => {
          if (!prev || String(prev.id) !== String(userId)) return prev;
          const nextDisplay =
            data?.display_name ||
            prev.display_name ||
            prev.full_name ||
            prev.username;
          const nextAvatar =
            data?.profile?.avatar_url ||
            prev.avatar_url ||
            prev.profile?.avatar_url ||
            "";
          return {
            ...prev,
            username: data?.username || prev.username,
            display_name: nextDisplay,
            full_name: nextDisplay || prev.full_name,
            avatar_url: nextAvatar,
            profile: {
              ...(prev.profile || {}),
              ...(data?.profile || {}),
              avatar_url: nextAvatar,
            },
          };
        });
      } catch {
        // Section note: groups related logic for readability.
      }
    };

    syncProfile();
    return () => {
      cancelled = true;
    };
  }, [authUser?.id]);

  const resetRegisterFlow = useCallback(() => {
    setRegisterEmail("");
    setRegisterStatus(makeStatus());
    setVerifyDigits(["", "", "", ""]);
    setVerifyStatus(makeStatus());
    setRegisterVerifiedEmail("");
    setRegisterPassword("");
    setRegisterPasswordConfirm("");
    setRegisterCompleteStatus(makeSimpleStatus());
    setVerifyContext(null);
  }, []);

  const resetResetFlow = useCallback(() => {
    setResetEmail("");
    setResetStatus(makeStatus());
    setVerifyDigits(["", "", "", ""]);
    setVerifyStatus(makeStatus());
    setResetVerifiedEmail("");
    setResetPasswords({ password: "", confirm: "" });
    setResetCompleteStatus(makeSimpleStatus());
    setVerifyContext(null);
  }, []);

  const startRegister = useCallback(async () => {
    const trimmed = registerEmail.trim();
    if (!trimmed) {
      setRegisterStatus({
        loading: false,
        message: "",
        error: "Please enter your school email address.",
        devCode: "",
      });
      return false;
    }
    setRegisterStatus({ loading: true, message: "", error: "", devCode: "" });
    try {
      const data = await postJson(AUTH_ENDPOINTS.registerStart, {
        email: trimmed,
      });
      setRegisterEmail(trimmed);
      setVerifyContext({ mode: "register", email: trimmed });
      setVerifyDigits(["", "", "", ""]);
      setRegisterStatus({
        loading: false,
        message: "Verification code sent to your email.",
        error: "",
        devCode: data.dev_code || "",
      });
      setVerifyStatus({
        loading: false,
        message: "Please enter the verification code received by email.",
        error: "",
        devCode: data.dev_code || "",
      });
      return true;
    } catch (error) {
      setRegisterStatus({
        loading: false,
        message: "",
        error: error.message,
        devCode: "",
      });
      return false;
    }
  }, [registerEmail]);

  const startReset = useCallback(async () => {
    const trimmed = resetEmail.trim();
    if (!trimmed) {
      setResetStatus({
        loading: false,
        message: "",
        error: "Please enter your registered email address.",
        devCode: "",
      });
      return false;
    }
    setResetStatus({ loading: true, message: "", error: "", devCode: "" });
    try {
      const data = await postJson(AUTH_ENDPOINTS.resetStart, {
        email: trimmed,
      });
      setResetEmail(trimmed);
      setVerifyContext({ mode: "reset", email: trimmed });
      setVerifyDigits(["", "", "", ""]);
      setResetStatus({
        loading: false,
        message: "Verification code sent to your email.",
        error: "",
        devCode: data.dev_code || "",
      });
      setVerifyStatus({
        loading: false,
        message: "Please enter the verification code you received.",
        error: "",
        devCode: data.dev_code || "",
      });
      return true;
    } catch (error) {
      setResetStatus({
        loading: false,
        message: "",
        error: error.message,
        devCode: "",
      });
      return false;
    }
  }, [resetEmail]);

  const resendCode = useCallback(async () => {
    if (!verifyContext) {
      setVerifyStatus((prev) => ({
        ...prev,
        error: "Please request the verification code first.",
      }));
      return false;
    }
    setVerifyStatus((prev) => ({
      ...prev,
      loading: true,
      message: "",
      error: "",
    }));
    try {
      const endpoint =
        verifyContext.mode === "register"
          ? AUTH_ENDPOINTS.registerStart
          : AUTH_ENDPOINTS.resetStart;
      const data = await postJson(endpoint, { email: verifyContext.email });
      setVerifyDigits(["", "", "", ""]);
      setVerifyStatus({
        loading: false,
        message: "A new verification code has been sent.",
        error: "",
        devCode: data.dev_code || "",
      });
      return true;
    } catch (error) {
      setVerifyStatus({
        loading: false,
        message: "",
        error: error.message,
        devCode: "",
      });
      return false;
    }
  }, [verifyContext]);

  const verifyRegisterCode = useCallback(async () => {
    if (!verifyContext || verifyContext.mode !== "register") {
      setVerifyStatus({
        loading: false,
        message: "",
        error: "Please request the verification code first.",
        devCode: "",
      });
      return false;
    }
    const code = verifyDigits.join("");
    if (code.length !== 4) {
      setVerifyStatus((prev) => ({
        ...prev,
        error: "Please enter the 4-digit verification code.",
      }));
      return false;
    }
    setVerifyStatus((prev) => ({
      ...prev,
      loading: true,
      message: "",
      error: "",
    }));
    try {
      await postJson(AUTH_ENDPOINTS.registerVerify, {
        email: verifyContext.email,
        code,
      });
      setRegisterVerifiedEmail(verifyContext.email);
      setVerifyStatus((prev) => ({
        ...prev,
        loading: false,
        message: "Verification succeeded. Please set your password.",
        error: "",
      }));
      return true;
    } catch (error) {
      setVerifyStatus({
        loading: false,
        message: "",
        error: error.message,
        devCode: "",
      });
      return false;
    }
  }, [verifyContext, verifyDigits]);

  const verifyResetCode = useCallback(async () => {
    if (!verifyContext || verifyContext.mode !== "reset") {
      setVerifyStatus({
        loading: false,
        message: "",
        error: "Please request the verification code first.",
        devCode: "",
      });
      return false;
    }
    const code = verifyDigits.join("");
    if (code.length !== 4) {
      setVerifyStatus((prev) => ({
        ...prev,
        error: "Please enter the 4-digit verification code.",
      }));
      return false;
    }
    setVerifyStatus((prev) => ({
      ...prev,
      loading: true,
      message: "",
      error: "",
    }));
    try {
      await postJson(AUTH_ENDPOINTS.resetVerify, {
        email: verifyContext.email,
        code,
      });
      setResetVerifiedEmail(verifyContext.email);
      setVerifyStatus((prev) => ({
        ...prev,
        loading: false,
        message: "Verification succeeded. Please set a new password.",
        error: "",
      }));
      return true;
    } catch (error) {
      setVerifyStatus({
        loading: false,
        message: "",
        error: error.message,
        devCode: "",
      });
      return false;
    }
  }, [verifyContext, verifyDigits]);

  const completeRegistration = useCallback(async () => {
    if (!registerVerifiedEmail) {
      setRegisterCompleteStatus({
        loading: false,
        message: "",
        error: "Please complete the verification code step first.",
      });
      return false;
    }
    if (registerPassword.length < 8) {
      setRegisterCompleteStatus({
        loading: false,
        message: "",
        error: "Password must be at least 8 characters long.",
      });
      return false;
    }
    if (registerPassword !== registerPasswordConfirm) {
      setRegisterCompleteStatus({
        loading: false,
        message: "",
        error: "The passwords you entered do not match.",
      });
      return false;
    }
    setRegisterCompleteStatus({ loading: true, message: "", error: "" });
    try {
      await postJson(AUTH_ENDPOINTS.registerComplete, {
        email: registerVerifiedEmail,
        password: registerPassword,
      });
      setRegisterCompleteStatus({
        loading: false,
        message: "Registration successful! Click the button to sign in.",
        error: "",
      });
      return true;
    } catch (error) {
      setRegisterCompleteStatus({
        loading: false,
        message: "",
        error: error.message,
      });
      return false;
    }
  }, [registerPassword, registerPasswordConfirm, registerVerifiedEmail]);

  const completeReset = useCallback(async () => {
    if (!resetVerifiedEmail) {
      setResetCompleteStatus({
        loading: false,
        message: "",
        error: "Please complete the verification code step first.",
      });
      return false;
    }
    if (resetPasswords.password.length < 8) {
      setResetCompleteStatus({
        loading: false,
        message: "",
        error: "Password must be at least 8 characters long.",
      });
      return false;
    }
    if (resetPasswords.password !== resetPasswords.confirm) {
      setResetCompleteStatus({
        loading: false,
        message: "",
        error: "The passwords you entered do not match.",
      });
      return false;
    }
    setResetCompleteStatus({ loading: true, message: "", error: "" });
    try {
      await postJson(AUTH_ENDPOINTS.resetComplete, {
        email: resetVerifiedEmail,
        password: resetPasswords.password,
      });
      setResetCompleteStatus({
        loading: false,
        message: "Password reset successful. Please sign in.",
        error: "",
      });
      return true;
    } catch (error) {
      setResetCompleteStatus({
        loading: false,
        message: "",
        error: error.message,
      });
      return false;
    }
  }, [resetPasswords, resetVerifiedEmail]);

  const login = useCallback(async (email, password) => {
    const data = await postJson(AUTH_ENDPOINTS.login, { email, password });
    setAuthUser(data.user || null);
    return { needsProfile: Boolean(data.needs_profile) };
  }, []);

  const logout = useCallback(async () => {
    try {
      await postJson(AUTH_ENDPOINTS.logout, {});
    } catch (error) {
      // Section note: groups related logic for readability.
    } finally {
      setAuthUser(null);
      resetRegisterFlow();
      resetResetFlow();
      setProfileStatus(makeSimpleStatus());
      setProfileData(createProfileData());
      setProfileOptions(null);
      setCourses({ joined: [], available: [] });
      setJoinCode("");
      setCourseStatus(makeSimpleStatus());
      setNotifications({ items: [], unread: 0 });
      setNotificationStatus(makeSimpleStatus());
    }
  }, [resetRegisterFlow, resetResetFlow]);

  const fetchProfileOptions = useCallback(async () => {
    if (profileOptions) {
      return profileOptions;
    }
    setProfileStatus((prev) => ({ ...prev, loading: true, error: "" }));
    try {
      const data = await getJson(`${PROFILE_ENDPOINT}/options/`);
      setProfileOptions(data);
      setProfileStatus((prev) => ({ ...prev, loading: false, error: "" }));
      return data;
    } catch (error) {
      setProfileStatus({ loading: false, message: "", error: error.message });
      throw error;
    }
  }, [profileOptions]);

  const loadMyProfile = useCallback(async () => {
    setProfileStatus((prev) => ({ ...prev, loading: true, error: "" }));
    try {
      const data = await getJson(`${PROFILE_ENDPOINT}/me/`);
      // Section note: groups related logic for readability.
      setProfileData({
        gender: data.gender || "",
        city: data.city || "",
        age_group: data.age_group || "",
        education_level: data.education_level || "",
        income_level: data.income_level || "",
        social_value: data.social_value || 5,
        interests: data.interests || [],
        sociability: data.sociability || 5,
        openness: data.openness || 5,
        shopping_frequency: data.shopping_frequency || "",
        buying_behavior: data.buying_behavior || "",
        decision_factor: data.decision_factor || "",
        shopping_preference: data.shopping_preference || "",
        digital_time: data.digital_time || "",
        content_preference: data.content_preference || "",
        interaction_style: data.interaction_style || "",
        influencer_type: data.influencer_type || "",
      });
      setProfileStatus((prev) => ({ ...prev, loading: false, error: "" }));
      return data;
    } catch (error) {
      setProfileStatus({ loading: false, message: "", error: error.message });
      throw error;
    }
  }, []);

  const updateProfileField = useCallback((field, value) => {
    setProfileData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const toggleInterest = useCallback((interest) => {
    setProfileData((prev) => {
      const exists = prev.interests.includes(interest);
      const next = exists
        ? prev.interests.filter((item) => item !== interest)
        : [...prev.interests, interest];
      return { ...prev, interests: next };
    });
  }, []);

  const submitProfile = useCallback(
    async (overrides) => {
      setProfileStatus({ loading: true, message: "", error: "" });
      try {
        const payload = overrides
          ? { ...profileData, ...overrides }
          : profileData;
        const data = await postJson(`${PROFILE_ENDPOINT}/submit/`, payload);
        const updatedName = data?.username || payload?.username || authUser?.username || "";
        setProfileStatus({
          loading: false,
          message: "Profile saved!",
          error: "",
        });
        if (authUser && updatedName) {
          setAuthUser((prev) => ({
            ...(prev || {}),
            username: updatedName,
          }));
        }
        return true;
      } catch (error) {
        setProfileStatus({ loading: false, message: "", error: error.message });
        return false;
      }
    },
    [profileData, authUser]
  );

  const loadCourseProfile = useCallback(async (courseId) => {
    if (!courseId) {
      throw new Error("Course id is required.");
    }
    return await getJson(`/api/courses/${courseId}/profile/`);
  }, []);

  const saveCourseProfile = useCallback(async (courseId, payload) => {
    if (!courseId) {
      throw new Error("Course id is required.");
    }
    return await postJson(`/api/courses/${courseId}/profile/`, payload);
  }, []);

  const fetchCourses = useCallback(async () => {
    setCourseStatus((prev) => ({ ...prev, loading: true, error: "" }));
    try {
      const data = await getJson(`${COURSE_ENDPOINT}/`);
      setCourses(data);
      setCourseStatus({ loading: false, message: "", error: "" });
      return data;
    } catch (error) {
      setCourseStatus({ loading: false, message: "", error: error.message });
      throw error;
    }
  }, []);

  const joinCourse = useCallback(async () => {
    const trimmed = joinCode.trim();
    if (!trimmed) {
      setCourseStatus({
        loading: false,
        message: "",
        error: "Please enter the course join code.",
      });
      return false;
    }
    setCourseStatus({ loading: true, message: "", error: "" });
    try {
      await postJson(`${COURSE_ENDPOINT}/join/`, { join_code: trimmed });
      setJoinCode("");
      await fetchCourses();
      setCourseStatus({ loading: false, message: "Joined course successfully!", error: "" });
      return true;
    } catch (error) {
      setCourseStatus({ loading: false, message: "", error: error.message });
      return false;
    }
  }, [joinCode, fetchCourses]);

  const fetchNotifications = useCallback(async ({ silent = true } = {}) => {
    if (!authUser) {
      setNotifications({ items: [], unread: 0 });
      setNotificationStatus(makeSimpleStatus());
      return { items: [], unread: 0 };
    }

    // Section note: groups related logic for readability.
    const identifier =
      (authUser.username || "").trim() ||
      (authUser.email || "").trim() ||
      String(authUser.id || "");
    if (!identifier) {
      const errorMessage = "Unable to identify the current user; notifications cannot be retrieved.";
      setNotificationStatus({
        loading: false,
        message: "",
        error: errorMessage,
      });
      return { items: [], unread: 0 };
    }

    setNotificationStatus((prev) => ({ ...prev, loading: true, error: "" }));
    try {
      const data = await getJson(
        `/api/messages/notifications/?user=${encodeURIComponent(identifier)}`
      );
      setNotifications({
        items: data.items || [],
        unread: typeof data.unread === "number" ? data.unread : 0,
      });
      // Section note: groups related logic for readability.
      if (!silent) {
        (data.items || []).forEach((item) =>
          registerNotification(item, { silent })
        );
      }
      setNotificationStatus({ loading: false, message: "", error: "" });
      return data;
    } catch (error) {
      setNotificationStatus({
        loading: false,
        message: "",
        error: error.message,
      });
      throw error;
    }
  }, [authUser, registerNotification]);

  useEffect(() => {
    if (!authUser) {
      offlineSummaryShownRef.current = false;
      if (typeof window !== "undefined") {
        try {
          const storageKey = `${LAST_NOTIF_PREFIX}lastUser`;
          window.localStorage.setItem(storageKey, "");
        } catch {}
      }
      return;
    }
    if (offlineSummaryShownRef.current) return;

    offlineSummaryShownRef.current = true;
    fetchNotifications({ silent: true })
      .then((data) => {
        let unseenCount = Number(data?.unread || 0);
        let lastSeenTime = null;
        if (typeof window !== "undefined") {
          const storageKey = `${LAST_NOTIF_PREFIX}${authUser.id ?? "unknown"}`;
          const stored = window.localStorage.getItem(storageKey);
          if (stored) {
            const parsed = new Date(stored);
            if (!Number.isNaN(parsed.getTime())) {
              lastSeenTime = parsed.getTime();
            }
          }
          try {
            window.localStorage.setItem(storageKey, new Date().toISOString());
          } catch {}
        }

        if (lastSeenTime) {
          const items = Array.isArray(data?.items) ? data.items : [];
          unseenCount = items.filter((item) => {
            const createdAt = item?.created_at;
            if (!createdAt) return false;
            const ts = new Date(createdAt).getTime();
            if (Number.isNaN(ts)) return false;
            return ts > lastSeenTime;
          }).length;
        }

        if (unseenCount > 0) {
          pushToast({
            title: "While you were away",
            message: `You have ${unseenCount} unread notifications since your last visit.`,
            link: "/notifications",
          });
        }
      })
      .catch(() => {});
  }, [authUser, fetchNotifications, pushToast]);

  const markNotificationsRead = useCallback(
    async (ids) => {
      if (!ids || ids.length === 0) return { updated: 0 };
      try {
        // Section note: groups related logic for readability.
        const identifier =
          (authUser?.username || "").trim() ||
          (authUser?.email || "").trim() ||
          String(authUser?.id || "");
        const data = await patchJson(
          `/api/messages/notifications/?user=${encodeURIComponent(identifier)}`,
          { ids }
        );
        // Section note: groups related logic for readability.
        setNotifications((prev) => {
          const nextItems = prev.items.map((n) =>
            ids.includes(n.id) ? { ...n, is_read: true } : n
          );
          const nextUnread = nextItems.filter((n) => !n.is_read).length;
          return { items: nextItems, unread: nextUnread };
        });
        return data;
      } catch (error) {
        setNotificationStatus({
          loading: false,
          message: "",
          error: error.message,
        });
        throw error;
      }
    },
    [authUser]
  );

  const markAllNotificationsRead = useCallback(async () => {
    try {
      const identifier =
        (authUser?.username || "").trim() ||
        (authUser?.email || "").trim() ||
        String(authUser?.id || "");
      const data = await patchJson(
        `/api/messages/notifications/?user=${encodeURIComponent(identifier)}`,
        { all: true }
      );
      // Section note: groups related logic for readability.
      setNotifications((prev) => {
        const nextItems = prev.items.map((n) => ({ ...n, is_read: true }));
        return { items: nextItems, unread: 0 };
      });
      return data;
    } catch (error) {
      setNotificationStatus({
        loading: false,
        message: "",
        error: error.message,
      });
      throw error;
    }
  }, [authUser]);

  useEffect(() => {
    // Section note: groups related logic for readability.
    if (!authUser) {
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch (_) {}
        wsRef.current = null;
      }
      return undefined;
    }

    // Section note: groups related logic for readability.
    const identifier =
      (authUser.username || "").trim() ||
      (authUser.email || "").trim() ||
      String(authUser.id || "");
    if (!identifier) return undefined;

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const wsUrl = `${protocol}://${
      window.location.host
    }/ws/notifications/?user=${encodeURIComponent(identifier)}`;
    console.log(
      "[WebSocket] Connecting to:",
      wsUrl,
      "| identifier:",
      identifier
    );
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data || "{}");
        console.log("[WebSocket] Message received:", data);
        if (data.type === "notification") {
          setNotifications((prev) => {
            const nextItems = [
              {
                ...data,
                is_read: Boolean(data.is_read) === true ? true : false,
              },
              ...prev.items,
            ];
            const nextUnread = nextItems.filter((n) => !n.is_read).length;
            return { items: nextItems, unread: nextUnread };
          });
          registerNotification(data, { silent: false });
        }
      } catch (_) {
        // Section note: groups related logic for readability.
      }
    };

    socket.onerror = () => {
      // Section note: groups related logic for readability.
    };

    socket.onclose = () => {
      if (wsRef.current === socket) {
        wsRef.current = null;
      }
    };

    return () => {
      try {
        socket.close();
      } catch (_) {}
    };
  }, [authUser]);

  const value = {
    authUser,
    isAuthenticated,
    authCheckComplete,
    setAuthUser,
    registerEmail,
    setRegisterEmail,
    registerStatus,
    startRegister,
    resetRegisterFlow,
    verifyDigits,
    setVerifyDigits,
    verifyStatus,
    verifyContext,
    verifyRegisterCode,
    verifyResetCode,
    resendCode,
    registerPassword,
    setRegisterPassword,
    registerPasswordConfirm,
    setRegisterPasswordConfirm,
    registerCompleteStatus,
    completeRegistration,
    registerVerifiedEmail,
    resetEmail,
    setResetEmail,
    resetStatus,
    startReset,
    resetResetFlow,
    resetVerifiedEmail,
    resetPasswords,
    setResetPasswords,
    resetCompleteStatus,
    completeReset,
    login,
    logout,
    profileOptions,
    fetchProfileOptions,
    loadMyProfile,
    profileData,
    updateProfileField,
        toggleInterest,
        profileStatus,
        submitProfile,
        loadCourseProfile,
        saveCourseProfile,
        courses,
    fetchCourses,
    courseStatus,
    joinCode,
    setJoinCode,
    joinCourse,
    notifications,
    notificationStatus,
    fetchNotifications,
    markNotificationsRead,
    markAllNotificationsRead,
    toasts,
    pushToast,
    dismissToast,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }
  return context;
}
