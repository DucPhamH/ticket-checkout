export type ApiErrorBody = {
  error: { code: string; message: string };
};

export type HealthResponse = {
  status: 'ok';
  db: 'ok' | 'down';
  time: string;
};

// One page of a cursor-paginated list. Pass `nextCursor` back as `?cursor=` for the next page;
// null means this was the last page.
export type Page<T> = {
  items: T[];
  nextCursor: string | null;
};
