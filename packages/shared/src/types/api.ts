export type ApiErrorBody = {
  error: { code: string; message: string };
};

export type HealthResponse = {
  status: 'ok';
  db: 'ok' | 'down';
  time: string;
};
