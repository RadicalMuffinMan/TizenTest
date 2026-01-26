import {createContext, useContext, useState, useEffect, useCallback} from 'react';
import * as jellyseerrApi from '../services/jellyseerrApi';
import {getFromStorage, saveToStorage, removeFromStorage} from '../services/storage';

const JellyseerrContext = createContext(null);

export const JellyseerrProvider = ({children}) => {
	const [isEnabled, setIsEnabled] = useState(false);
	const [isAuthenticated, setIsAuthenticated] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [user, setUser] = useState(null);
	const [serverUrl, setServerUrl] = useState(null);

	// Save session cookie to storage after successful operations
	const persistSession = useCallback(async () => {
		const config = await getFromStorage('jellyseerr');
		const currentSession = jellyseerrApi.getSessionCookie();
		if (config && currentSession) {
			await saveToStorage('jellyseerr', {...config, sessionCookie: currentSession});
			console.log('[Jellyseerr] Session persisted to storage');
		}
	}, []);

	useEffect(() => {
		const init = async () => {
			try {
				const config = await getFromStorage('jellyseerr');
				if (config?.url && config?.userId) {
					// Restore session cookie if saved
					jellyseerrApi.setConfig(
						config.url,
						config.userId,
						config.apiKey,
						config.sessionCookie
					);
					setServerUrl(config.url);
					setIsEnabled(true);

					// If we have an API key, just verify it works with /status
					if (config.apiKey) {
						try {
							await jellyseerrApi.testConnection();
							// API key works - mark as authenticated
							// We don't have user info but that's OK for API key auth
							setUser({displayName: 'API Key User', permissions: 0xFFFFFFFF});
							setIsAuthenticated(true);
							console.log('[Jellyseerr] API key validated');
						} catch (e) {
							console.log('[Jellyseerr] API key validation failed:', e.message);
						}
					} else {
						// Cookie-based auth - try to get user
						try {
							const userData = await jellyseerrApi.getUser();
							setUser(userData);
							setIsAuthenticated(true);
						} catch (e) {
							console.log('[Jellyseerr] Session check failed, may need to re-login');
							jellyseerrApi.setSessionCookie(null);
						}
					}
				}
			} catch (e) {
				console.error('[Jellyseerr] Init failed:', e);
			} finally {
				setIsLoading(false);
			}
		};
		init();
	}, []);

	const configure = useCallback(async (url, userId, apiKey = null) => {
		jellyseerrApi.setConfig(url, userId, apiKey);
		setServerUrl(url);
		setIsEnabled(true);
		await saveToStorage('jellyseerr', {url, userId, apiKey});

		// If using API key, validate with /status (not /auth/me which requires cookies)
		if (apiKey) {
			try {
				await jellyseerrApi.testConnection();
				// API key works - mark as authenticated
				setUser({displayName: 'API Key User', permissions: 0xFFFFFFFF});
				setIsAuthenticated(true);
				console.log('[Jellyseerr] API key validated successfully');
			} catch (e) {
				console.log('[Jellyseerr] API key validation failed:', e.message);
				throw e; // Let caller handle the error
			}
		}
	}, []);

	const login = useCallback(async (email, password) => {
		const result = await jellyseerrApi.login(email, password);
		setUser(result);
		setIsAuthenticated(true);
		// Try to persist the session cookie
		await persistSession();
		return result;
	}, [persistSession]);

	const loginWithJellyfin = useCallback(async (username, password, jellyfinHost) => {
		const result = await jellyseerrApi.loginWithJellyfin(username, password, jellyfinHost);
		setUser(result);
		setIsAuthenticated(true);
		// Try to persist the session cookie
		await persistSession();
		return result;
	}, [persistSession]);

	const logout = useCallback(async () => {
		await jellyseerrApi.logout();
		setUser(null);
		setIsAuthenticated(false);
	}, []);

	const disable = useCallback(async () => {
		await jellyseerrApi.clearCookies();
		await removeFromStorage('jellyseerr');
		jellyseerrApi.setConfig(null, null, null);
		setServerUrl(null);
		setUser(null);
		setIsEnabled(false);
		setIsAuthenticated(false);
	}, []);

	return (
		<JellyseerrContext.Provider value={{
			isEnabled,
			isAuthenticated,
			isLoading,
			user,
			serverUrl,
			api: jellyseerrApi,
			configure,
			login,
			loginWithJellyfin,
			logout,
			disable
		}}>
			{children}
		</JellyseerrContext.Provider>
	);
};

export const useJellyseerr = () => {
	const context = useContext(JellyseerrContext);
	if (!context) {
		throw new Error('useJellyseerr must be used within JellyseerrProvider');
	}
	return context;
};
