
-- Function to notify on comment reply
CREATE OR REPLACE FUNCTION public.notify_comment_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_parent_user_id uuid;
  v_replier_username text;
  v_market_title text;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO v_parent_user_id
  FROM market_comments WHERE id = NEW.parent_id;

  IF v_parent_user_id IS NULL OR v_parent_user_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(username, split_part(email, '@', 1)) INTO v_replier_username
  FROM profiles WHERE id = NEW.user_id;

  SELECT title INTO v_market_title
  FROM markets WHERE id = NEW.market_id;

  INSERT INTO notifications (user_id, title, message, type)
  VALUES (
    v_parent_user_id,
    'Nueva respuesta a tu comentario',
    COALESCE(v_replier_username, 'Alguien') || ' respondió a tu comentario en "' || COALESCE(v_market_title, 'un mercado') || '"',
    'comment_reply'
  );

  RETURN NEW;
END;
$$;

-- Function to notify on comment reaction
CREATE OR REPLACE FUNCTION public.notify_comment_reaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_comment_owner_id uuid;
  v_reactor_username text;
  v_market_title text;
  v_market_id uuid;
  v_reaction_label text;
BEGIN
  SELECT mc.user_id, mc.market_id INTO v_comment_owner_id, v_market_id
  FROM market_comments mc WHERE mc.id = NEW.comment_id;

  IF v_comment_owner_id IS NULL OR v_comment_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(username, split_part(email, '@', 1)) INTO v_reactor_username
  FROM profiles WHERE id = NEW.user_id;

  SELECT title INTO v_market_title
  FROM markets WHERE id = v_market_id;

  v_reaction_label := CASE WHEN NEW.reaction_type = 'like' THEN '👍' ELSE '👎' END;

  INSERT INTO notifications (user_id, title, message, type)
  VALUES (
    v_comment_owner_id,
    'Reacción en tu comentario',
    COALESCE(v_reactor_username, 'Alguien') || ' reaccionó ' || v_reaction_label || ' a tu comentario en "' || COALESCE(v_market_title, 'un mercado') || '"',
    'comment_reaction'
  );

  RETURN NEW;
END;
$$;

-- Triggers
CREATE TRIGGER on_comment_reply
  AFTER INSERT ON public.market_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_comment_reply();

CREATE TRIGGER on_comment_reaction
  AFTER INSERT ON public.comment_reactions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_comment_reaction();
