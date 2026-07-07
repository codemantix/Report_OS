import { useState } from 'react';
import toast from 'react-hot-toast';
import { formatDateTime } from '../../utils/dateHelpers';
import { getProfileDisplayName, getProfileInitials } from '../../utils/profileHelpers';
import { addTaskComment } from '../../services/taskService';
import styles from './Tasks.module.css';

export default function TaskComments({ taskId, comments, currentUserId, onCommentAdded }) {
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!comment.trim()) return;

    setSubmitting(true);
    const { data, error } = await addTaskComment(taskId, currentUserId, comment.trim());

    if (error) {
      toast.error('Failed to add comment');
      setSubmitting(false);
      return;
    }

    setComment('');
    toast.success('Comment added');
    onCommentAdded?.(data);
    setSubmitting(false);
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className={styles.commentBox}>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className={styles.commentInput}
          placeholder="Add a comment…"
        />
        <button type="submit" disabled={!comment.trim() || submitting} className={styles.submitBtn} style={{ alignSelf: 'flex-start' }}>
          {submitting ? 'Adding...' : 'Add Comment'}
        </button>
      </form>

      <div className="mt-6 space-y-3">
        {(!comments || comments.length === 0) && (
          <p className="text-sm text-center py-4" style={{ color: 'var(--color-muted)' }}>No comments yet.</p>
        )}
        {comments?.map((c) => (
          <div key={c.id} className={styles.commentItem}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className={styles.userAvatar}>
                  {c.user?.avatar_url ? <img src={c.user.avatar_url} alt="" className={styles.userAvatarImage} /> : getProfileInitials(c.user, 'U')}
                </span>
                <span className={styles.commentAuthor}>{getProfileDisplayName(c.user, 'User')}</span>
              </div>
              <span className={styles.commentDate}>{formatDateTime(c.created_at)}</span>
            </div>
            <p className={styles.commentText}>{c.comment}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
