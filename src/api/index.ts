import type { ApiClient } from './types';
import { supabaseClient } from './supabaseClient';

export const api: ApiClient = supabaseClient;
export type { ApiClient } from './types';
