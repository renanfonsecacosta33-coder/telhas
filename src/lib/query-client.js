import { QueryClient } from '@tanstack/react-query';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			refetchOnReconnect: "always",
			retry: 1,
			staleTime: 1000 * 30, // 30 segundos: exibe dados da memória instantaneamente sem piscar
			gcTime: 1000 * 60 * 15, // 15 minutos em cache local
			networkMode: "offlineFirst", // Prioriza cache local para velocidade máxima
		},
		mutations: {
			retry: 1,
			networkMode: "offlineFirst",
		},
	},
});