import { QuestionDetail, QuestionListItem } from '../../domain/questions/question.repository';

export interface QuestionListResponse {
  items: QuestionListItem[];
  nextCursor: string | null;
  total: number;
}

export type QuestionDetailResponse = QuestionDetail;
