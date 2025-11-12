// src/index.ts
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

// ============================
//  Errores
// ============================
export class RobleApiException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RobleApiException';
  }
}

// ============================
//  Configuración
// ============================
export type RobleApiHeaders = Record<string, string>;

export interface RobleApiConfig {
  /** URL base del backend, p.ej: https://roble.uninorte.edu.co/api */
  baseURL: string;

  /** Parte dinámica del endpoint (el “codeurl” que viene desde la app) */
  codeUrl: string;

  /** Headers para AUTH (opcional) */
  authHeaders?: RobleApiHeaders;

  /** Headers para DATA/DB (opcional) */
  dataHeaders?: RobleApiHeaders;

  /** Timeout en ms (default 30000) */
  timeoutMs?: number;

  /**
   * Cómo construir la ruta final según el tipo y endpoint.
   * Por defecto:
   *   auth: /auth/{codeUrl}/{endpoint}
   *   data: /database/{codeUrl}/{endpoint}
   */
  pathBuilder?: (kind: 'auth' | 'database', endpoint: string, codeUrl: string) => string;
}

// ============================
//  Cliente principal
// ============================
export class RobleApiClient {
  private readonly config: RobleApiConfig;
  private readonly http: AxiosInstance;

  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  static DEFAULT_TIMEOUT = 30_000;

  constructor(config: RobleApiConfig) {
    this.config = {
      timeoutMs: RobleApiClient.DEFAULT_TIMEOUT,
      pathBuilder: (kind, endpoint, codeUrl) =>
      (kind === 'auth'
        ? `/auth/${codeUrl}/${endpoint}`
        : `/database/${codeUrl}/${endpoint}`),
      ...config,
    };

    this.http = axios.create({
      baseURL: this.config.baseURL.replace(/\/+$/, ''), // sin / final
      timeout: this.config.timeoutMs,
    });

    // Interceptor para anexar Authorization automáticamente si hay token
    this.http.interceptors.request.use((cfg) => {
      cfg.headers = cfg.headers ?? {};
      (cfg.headers as any)['Content-Type'] = 'application/json';
      // headers base (según tipo) los añadimos en _makeRequest
      if (this.accessToken) {
        (cfg.headers as any)['Authorization'] = `Bearer ${this.accessToken}`;
      }
      return cfg;
    });
  }

  // ============================
  //  Getters y setters de token
  // ============================
  getAccessToken(): string | null {
    return this.accessToken;
  }

  getRefreshToken(): string | null {
    return this.refreshToken;
  }

  /** Permite inyectar una función que se ejecutará cuando cambie el accessToken */
  onTokenUpdate?: (token: string | null) => void;

  private updateAccessToken(token: string | null) {
    this.accessToken = token;
    if (this.onTokenUpdate) this.onTokenUpdate(token);
  }

  private updateRefreshToken(token: string | null) {
    this.refreshToken = token;
  }

  setTokens(tokens: { accessToken: string; refreshToken: string }) {
    this.updateAccessToken(tokens.accessToken);
    this.updateRefreshToken(tokens.refreshToken);
  }

  clearTokens() {
    this.updateAccessToken(null);
    this.updateRefreshToken(null);
  }

  // ============================
  //  Helpers internos
  // ============================
  private mergeHeaders(base?: RobleApiHeaders, extra?: RobleApiHeaders): RobleApiHeaders {
    return {
      'Content-Type': 'application/json',
      ...(base ?? {}),
      ...(extra ?? {}),
    };
  }

  private buildPath(kind: 'auth' | 'database', endpoint: string) {
    return this.config.pathBuilder!(kind, endpoint, this.config.codeUrl);
  }

  private async _makeRequest<T = any>(
    kind: 'auth' | 'database',
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    {
      body,
      query,
      extraHeaders,
      isAuthRequest = false, // true solo para login/refresh/signup/logout
    }: {
      body?: any;
      query?: Record<string, any>;
      extraHeaders?: RobleApiHeaders;
      isAuthRequest?: boolean;
    } = {}
  ): Promise<T> {
    const url = this.buildPath(kind, endpoint);

    const headers = this.mergeHeaders(
      kind === 'auth' ? this.config.authHeaders : this.config.dataHeaders,
      extraHeaders
    );

    const cfg: AxiosRequestConfig = {
      url,
      method,
      headers,
      params: query,
      data: body ? JSON.stringify(body) : undefined,
      validateStatus: () => true, // manejamos status manualmente
    };

    let res = await this.http.request(cfg);

    // Éxito 2xx
    if (res.status >= 200 && res.status < 300) return res.data as T;

    // 401 en endpoints de DATA: intentar refresh una vez
    if (res.status === 401 && !isAuthRequest && this.refreshToken) {
      try {
        await this.refreshAccessToken(); // puede lanzar
        res = await this.http.request(cfg); // reintento una sola vez
        if (res.status >= 200 && res.status < 300) return res.data as T;
      } catch (e: any) {
        throw new RobleApiException(`Token expirado y no se pudo refrescar: ${e?.message ?? e}`);
      }
    }

    // Otros errores
    const msg = (res.data && (res.data.message || res.data.error)) || `HTTP ${res.status}`;
    throw new RobleApiException(String(msg));
  }

  // ============================
  //  AUTH
  // ============================

  async register(name: string, email: string, password: string): Promise<Record<string, any>> {
    return this._makeRequest('auth', 'POST', 'signup-direct', {
      body: { name, email, password },
      isAuthRequest: true,
    });
  }

  async refreshTokenManual(refreshToken: string): Promise<Record<string, any>> {
    return this._makeRequest('auth', 'POST', 'refresh-token', {
      body: { refreshToken },
      isAuthRequest: true,
    });
  }

  async login(email: string, password: string) {
    const data = await this._makeRequest<any>('auth', 'POST', 'login', {
      body: { email, password },
      isAuthRequest: true,
    });

    if (data?.accessToken && data?.refreshToken) {
      this.setTokens({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });
    }

    return data;
  }

  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) throw new RobleApiException('No hay refresh token disponible.');
    const data = await this._makeRequest<any>('auth', 'POST', 'refresh-token', {
      body: { refreshToken: this.refreshToken },
      isAuthRequest: true,
    });
    if (!data?.accessToken) throw new RobleApiException('Respuesta inválida al refrescar token.');
    this.updateAccessToken(data.accessToken);
  }

  async logout(): Promise<void> {
    if (!this.accessToken) {
      throw new RobleApiException('No hay token activo para cerrar sesión.');
    }

    await this._makeRequest('auth', 'POST', 'logout', {
      isAuthRequest: true,
      // No body → el token va en el header Authorization (interceptor ya lo añade)
    });

    this.clearTokens();
  }



  // ============================
  //  TABLAS / CRUD
  // ============================
  async createTable(
    tableName: string,
    columns: Array<{ name: string; type: string; nullable?: boolean; default?: any }>
  ): Promise<void> {
    await this._makeRequest('database', 'POST', 'create-table', {
      body: {
        tableName,
        description: `Tabla ${tableName} creada desde cliente móvil`,
        columns,
      },
    });
  }

  async getTableData(tableName: string): Promise<any> {
    return this._makeRequest('database', 'GET', 'table-data', {
      query: { schema: 'public', table: tableName },
    });
  }

  /** Inserta un registro y devuelve el registro insertado (o respuesta del backend). */
  async create(tableName: string, data: Record<string, any>): Promise<Record<string, any>> {
    const res = await this._makeRequest<any>('database', 'POST', 'insert', {
      body: { tableName, records: [data] },
    });

    if (res?.inserted?.length) return { ...res.inserted[0] };
    if (res && typeof res === 'object') return res;
    throw new RobleApiException('No se pudo insertar el registro');
  }

  async read(tableName: string, filters?: Record<string, any>): Promise<Array<Record<string, any>>> {
    const query: Record<string, string> = { tableName };
    if (filters) Object.entries(filters).forEach(([k, v]) => (query[k] = String(v)));
    const res = await this._makeRequest<any>('database', 'GET', 'read', { query });
    if (Array.isArray(res)) return res as Array<Record<string, any>>;
    if (res?.data) return res.data as Array<Record<string, any>>;
    return [];
  }

  async update(tableName: string, id: string | number, data: Record<string, any>): Promise<Record<string, any>> {
    const { _id, id: _, ...updates } = data ?? {};
    return this._makeRequest('database', 'PUT', 'update', {
      body: {
        tableName,
        idColumn: '_id',
        idValue: id,
        updates,
      },
    });
  }

  async delete(tableName: string, id: string | number): Promise<Record<string, any>> {
    return this._makeRequest('database', 'DELETE', 'delete', {
      body: {
        tableName,
        idColumn: '_id',
        idValue: id,
      },
    });
  }

  // ============================
  //  Conveniencia (helpers)
  // ============================
  async getAll(tableName: string) {
    return this.read(tableName);
  }

  async getById(tableName: string, id: string | number) {
    const rows = await this.read(tableName, { _id: id });
    return rows.length ? rows[0] : null;
  }

  async getWhere(tableName: string, column: string, value: any) {
    return this.read(tableName, { [column]: value });
  }

}

// ============================
//  Factoría simple (opcional)
// ============================
export function createRobleClient(config: RobleApiConfig) {
  return new RobleApiClient(config);
}
