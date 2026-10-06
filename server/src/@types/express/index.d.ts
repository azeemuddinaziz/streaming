// Define the shape of your User payload
export interface UserPayload {
  id: string;
  email: string;
  name: string;
}

export interface ChannelPayload {
  id: string;
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
      channel?: ChannelPayload;
    }
  }
}
