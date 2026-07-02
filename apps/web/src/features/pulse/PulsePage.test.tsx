import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { RouterProvider } from "@tanstack/react-router";
import { expect, test } from "vitest";
import { router } from "../../router";

test("renders the Pulse workspace", async () => {
  await router.navigate({ to: "/pulse" });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  expect(
    await screen.findByRole("heading", { name: "Your market, in motion." }),
  ).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Opportunity field" })).toBeInTheDocument();
});
