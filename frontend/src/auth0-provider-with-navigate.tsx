import { AppState, Auth0Provider } from "@auth0/auth0-react";
import { useNavigate } from "react-router-dom";

type Props = {
  children: React.ReactNode
}
export default function Auth0ProviderWithNavigate({ children }: Props) {
  const navigate = useNavigate();

  const domain = (import.meta as any).env.VITE_AUTH0_DOMAIN;
  const clientId = (import.meta as any).env.VITE_AUTH0_CLIENT_ID;
  const redirectUri = (import.meta as any).env.VITE_AUTH0_CALLBACK_URL || window.location.origin + '/auth/login';
  const audience = (import.meta as any).env.VITE_AUTH0_AUDIENCE;

  const onRedirectCallback = (appState: AppState | undefined) => {
    navigate('dashboard')
    //navigate(appState?.returnTo || window.location.origin);
  };

  if (!(domain && clientId && redirectUri && audience)) {
    return null;
  }

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: redirectUri,
        audience: audience,
      }}
      cacheLocation="localstorage"
      onRedirectCallback={onRedirectCallback}
    >
      {children}
    </Auth0Provider>
  );
};
