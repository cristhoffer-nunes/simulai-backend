import { Result } from '../../../shared/result/result';
import { QuestionClassification } from '../domain/questions/question.entity';
import { FieldError } from '../domain/shared/field-error';
import { ITaxonomyRepository } from '../domain/taxonomy/taxonomy.repository';

/**
 * Checks that the subject is visible to the student and that the topic (if any) belongs to it
 * (data model: topic.subject_id = question.subject_id).
 */
export async function resolveClassification(
  taxonomy: ITaxonomyRepository,
  userId: string,
  subjectId: string,
  topicId: string | null,
): Promise<Result<QuestionClassification, FieldError[]>> {
  const subject = await taxonomy.findVisibleSubject(userId, subjectId);
  if (!subject) {
    return Result.fail([
      { path: 'subjectId', code: 'UNKNOWN_SUBJECT', message: 'Subject not found.' },
    ]);
  }
  if (topicId && !subject.findTopic(topicId)) {
    return Result.fail([
      {
        path: 'topicId',
        code: 'TOPIC_NOT_IN_SUBJECT',
        message: 'Topic not found in this subject.',
      },
    ]);
  }
  return Result.ok({ subjectId: subject.id, topicId: topicId ?? null });
}
