import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render as testingLibraryRender } from "@testing-library/react";

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  });

export function render(ui: React.ReactElement, options?: Parameters<typeof testingLibraryRender>[1]) {
  const queryClient = createTestQueryClient();

  return testingLibraryRender(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>, options);
}
