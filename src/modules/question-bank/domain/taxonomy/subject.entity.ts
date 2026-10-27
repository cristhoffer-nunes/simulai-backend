import { randomUUID } from 'node:crypto';
import { CatalogName } from '../shared/catalog-name.vo';

export interface TopicProps {
  id: string;
  subjectId: string;
  ownerUserId: string | null;
  name: string;
}

export interface SubjectProps {
  id: string;
  knowledgeAreaId: string;
  /** null = shared catalog entry (seed); set = private to that student (RN-001). */
  ownerUserId: string | null;
  name: string;
  /** Only the topics the current reader can see (catalog + their own). */
  topics: TopicProps[];
}

/** Aggregate root of the taxonomy: a subject and its topics. */
export class Subject {
  private constructor(private readonly props: SubjectProps) {}

  static create(knowledgeAreaId: string, ownerUserId: string, name: CatalogName): Subject {
    return new Subject({
      id: randomUUID(),
      knowledgeAreaId,
      ownerUserId,
      name: name.toString(),
      topics: [],
    });
  }

  static reconstitute(props: SubjectProps): Subject {
    return new Subject({ ...props, topics: [...props.topics] });
  }

  get id(): string {
    return this.props.id;
  }
  get knowledgeAreaId(): string {
    return this.props.knowledgeAreaId;
  }
  get ownerUserId(): string | null {
    return this.props.ownerUserId;
  }
  get name(): string {
    return this.props.name;
  }
  get topics(): readonly TopicProps[] {
    return this.props.topics;
  }

  isVisibleTo(userId: string): boolean {
    return this.props.ownerUserId === null || this.props.ownerUserId === userId;
  }

  findTopic(topicId: string): TopicProps | undefined {
    return this.props.topics.find((topic) => topic.id === topicId);
  }

  findTopicByName(name: CatalogName): TopicProps | undefined {
    const key = name.matchKey();
    return this.props.topics.find((topic) => CatalogName.keyOf(topic.name) === key);
  }

  /** A private topic for this student under this subject. Callers check for duplicates first. */
  newTopic(ownerUserId: string, name: CatalogName): TopicProps {
    const topic: TopicProps = {
      id: randomUUID(),
      subjectId: this.props.id,
      ownerUserId,
      name: name.toString(),
    };
    this.props.topics.push(topic);
    return topic;
  }
}
