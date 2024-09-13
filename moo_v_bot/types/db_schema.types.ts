export interface CompositeKey {
  chat_id: number;
  deleted: number;
}

export interface UserSchema extends CompositeKey {
  movies: string[];
  user_data: {
    first_name: string;
    last_name: string;
    timeUserAdded: number;
    timeUserLastAction: number;
    username: string;
  };
  waitForMovieInput: number;
}

export interface GroupSchema extends CompositeKey {
  group_data: {
    group_name: string;
    group_title: string;
    timeUserAdded: number;
    timeUserLastAction: number;
  };
  votes: {
    participants: {
      active: boolean;
      poll_id: number;
      user_ids: number[];
    };
  };
}
