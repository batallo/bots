export interface CompositeKey {
  chat_id: number;
  deleted: number;
}

interface UserData {
  first_name: string;
  last_name: string;
  timeUserAdded: number;
  timeUserLastAction: number;
  username: string;
}

export interface StoredStreamingMovies {
  [movieId: number]: {
    title: string;
    link: string;
  }
}

interface StreamingData {
  ready: StoredStreamingMovies;
  await: StoredStreamingMovies;
}

export interface UserSchema extends CompositeKey {
  movies: string[];
  user_data: UserData;
  streaming: StreamingData;
  waitForMovieInput: number; // TO DO: consider changing to boolean,
  waitForStreamingInput: number; // TO DO: consider changing to boolean
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
      poll_id: string;
      user_ids: number[];
    };
  };
}
