export function nextDocumentSearch(applied: string, draft: string, page: number) {
  return { applied: draft, page: 0, refetch: applied === draft && page === 0 };
}
