export interface UserSchema {
  chat_id: number;
  deleted: number;
  movies: string[];
  user_data: {
    first_name: string;
    last_name: string;
    timeUserAdded: number;
    timeUserLastAction: number;
    username: string;
  };
  waitForMovieInput: boolean;
}
